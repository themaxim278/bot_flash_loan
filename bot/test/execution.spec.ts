import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeOpportunity } from '../src/execution/execute';
import type { Opportunity } from '../src/discovery/types';
import type { EvaluationContext } from '../src/evaluation/types';
import type { OnChainSimulationResult } from '../src/simulation/simulate';

// Mock ethers
vi.mock('ethers', () => ({
  JsonRpcProvider: vi.fn(() => ({
    getFeeData: vi.fn(),
    send: vi.fn(),
    waitForTransaction: vi.fn(),
  })),
  Wallet: vi.fn(() => ({
    getNonce: vi.fn(),
    signTransaction: vi.fn(),
  })),
  Contract: vi.fn(() => ({
    executeOperation: {
      estimateGas: vi.fn(),
    },
    interface: {
      encodeFunctionData: vi.fn(),
    },
  })),
  parseUnits: vi.fn((value, unit) => BigInt(value) * BigInt(10 ** (unit === 'gwei' ? 9 : 18))),
  formatUnits: vi.fn((value, unit) => (Number(value) / (10 ** (unit === 'gwei' ? 9 : 18))).toString()),
  AbiCoder: {
    defaultAbiCoder: () => ({
      encode: vi.fn(() => '0x1234567890abcdef'),
    }),
  },
}));

// Mock fetch for relay testing
global.fetch = vi.fn();

describe('executeOpportunity', () => {
  let mockOpportunity: Opportunity;
  let mockSimulationResult: OnChainSimulationResult;
  let mockContext: EvaluationContext;
  let mockProvider: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockOpportunity = {
      path: ['WETH', 'USDC', 'DAI'],
      spreadBps: 25,
      minLiquidityUsd: 50000,
    };

    mockSimulationResult = {
      path: ['WETH', 'USDC', 'DAI'],
      expectedOutWei: BigInt('1100000000000000000'), // 1.1 ETH
      gasEstimatedWei: BigInt('50000000000000000'), // 0.05 ETH
      netProfitWei: BigInt('30000000000000000'), // 0.03 ETH
      ok: true,
      simulated: true,
    };

    mockContext = {
      cfg: {
        network: 'sepolia',
        rpcUrl: 'https://sepolia.infura.io/v3/test',
        relayUrl: 'https://relay.flashbots.net',
        executorAddress: '0x1234567890123456789012345678901234567890',
        minNetProfitWei: 10000000000000000, // 0.01 ETH
        maxSlippageBps: 30,
        deadlineSeconds: 300,
        maxGasWei: 100000000000000000, // 0.1 ETH
        flashLoan: { provider: 'aaveV3', feeBps: 9 },
        notionalUsdDefault: 1000,
      },
      mevBufferBps: 5,
      ethUsdPrice: 3500,
    } as any;

    mockProvider = {
      getFeeData: vi.fn().mockResolvedValue({
        maxFeePerGas: BigInt('20000000000'), // 20 gwei
        maxPriorityFeePerGas: BigInt('2000000000'), // 2 gwei
        gasPrice: BigInt('20000000000'),
      }),
      send: vi.fn(),
      waitForTransaction: vi.fn(),
    };
  });

  describe('Dry Run Mode', () => {
    it('should return transaction data without sending for dry run', async () => {
      // Ensure reasonable gas estimate to avoid errors in dry-run
      const { Contract } = await import('ethers');
      (Contract as any).mockImplementation(() => ({
        executeOperation: {
          estimateGas: vi.fn().mockResolvedValue(200000n),
        },
        interface: {
          encodeFunctionData: vi.fn().mockReturnValue('0x1234567890abcdef'),
        },
      }));

      const result = await executeOpportunity(
        mockOpportunity,
        mockSimulationResult,
        mockContext,
        mockProvider,
        { dryRun: true }
      );

      expect(result.status).toBe('dry-run');
      expect(result.txData).toBeDefined();
      expect(result.txData?.to).toBe(mockContext.cfg.executorAddress);
      expect(result.txData?.gasLimit).toBeDefined();
      expect(result.txData?.maxFeePerGas).toBeDefined();
      expect(result.txData?.maxPriorityFeePerGas).toBeDefined();
      expect(result.txHash).toBeUndefined();
      expect(result.relayUsed).toBe(false);
    });

    it('should calculate EIP-1559 pricing correctly', async () => {
      // Ensure reasonable gas estimate to avoid errors in dry-run
      const { Contract } = await import('ethers');
      (Contract as any).mockImplementation(() => ({
        executeOperation: {
          estimateGas: vi.fn().mockResolvedValue(200000n),
        },
        interface: {
          encodeFunctionData: vi.fn().mockReturnValue('0x1234567890abcdef'),
        },
      }));

      const result = await executeOpportunity(
        mockOpportunity,
        mockSimulationResult,
        mockContext,
        mockProvider,
        { dryRun: true }
      );

      expect(result.txData?.maxFeePerGas).toBe('22000000000'); // 20 gwei * 1.1
      expect(result.txData?.maxPriorityFeePerGas).toBe('2200000000'); // 2 gwei * 1.1
    });
  });

  describe('Safety Guards', () => {
    it('should block execution on non-sepolia network', async () => {
      const nonSepoliaContext = {
        ...mockContext,
        cfg: { ...mockContext.cfg, network: 'mainnet' },
      };

      const result = await executeOpportunity(
        mockOpportunity,
        mockSimulationResult,
        nonSepoliaContext,
        mockProvider,
        { dryRun: false, privateKey: '0x1234' }
      );

      expect(result.status).toBe('blocked');
      expect(result.revertReason).toBe('network-not-sepolia');
    });

    it('should block execution when profit is below minimum', async () => {
      const lowProfitSimulation = {
        ...mockSimulationResult,
        netProfitWei: BigInt('5000000000000000'), // 0.005 ETH, below minimum
      };

      const result = await executeOpportunity(
        mockOpportunity,
        lowProfitSimulation,
        mockContext,
        mockProvider,
        { dryRun: false, privateKey: '0x1234' }
      );

      expect(result.status).toBe('blocked');
      expect(result.revertReason).toBe('profit-below-minimum');
    });

    it('should block execution when simulation failed', async () => {
      const failedSimulation = {
        ...mockSimulationResult,
        ok: false,
        revertReason: 'slippage-too-high',
      };

      const result = await executeOpportunity(
        mockOpportunity,
        failedSimulation,
        mockContext,
        mockProvider,
        { dryRun: false, privateKey: '0x1234' }
      );

      expect(result.status).toBe('blocked');
      expect(result.revertReason).toBe('slippage-too-high');
    });

    it('should block execution when executor address is missing', async () => {
      const noExecutorContext = {
        ...mockContext,
        cfg: { ...mockContext.cfg, executorAddress: undefined },
      };

      const result = await executeOpportunity(
        mockOpportunity,
        mockSimulationResult,
        noExecutorContext,
        mockProvider,
        { dryRun: false, privateKey: '0x1234' }
      );

      expect(result.status).toBe('blocked');
      expect(result.revertReason).toBe('missing-executor-address');
    });

    it('should block execution when gas cost is too high', async () => {
      // Mock high gas estimation
      const { Contract } = await import('ethers');
      const mockContract = {
        executeOperation: {
          estimateGas: vi.fn().mockResolvedValue(BigInt('10000000')), // Very high gas
        },
        interface: {
          encodeFunctionData: vi.fn().mockReturnValue('0x1234'),
        },
      };
      (Contract as any).mockImplementation(() => mockContract);

      const result = await executeOpportunity(
        mockOpportunity,
        mockSimulationResult,
        mockContext,
        mockProvider,
        { dryRun: false, privateKey: '0x1234' }
      );

      expect(result.status).toBe('blocked');
      expect(result.revertReason).toBe('gas-cost-too-high');
    });
  });

  describe('Real Execution', () => {
    beforeEach(() => {
      // Configure provider and default mocks for a successful flow
      mockProvider.send.mockResolvedValue('0xtxhash123');
      mockProvider.waitForTransaction.mockResolvedValue({
        status: 1,
        gasUsed: BigInt('180000'),
      });
    });

    it('should execute transaction successfully with direct submission', async () => {
      const contextWithoutRelay = {
        ...mockContext,
        cfg: { ...mockContext.cfg, relayUrl: '' },
      };

      // Ensure reasonable gas estimate and wallet signing
      const { Contract, Wallet } = await import('ethers');
      (Contract as any).mockImplementation(() => ({
        executeOperation: {
          estimateGas: vi.fn().mockResolvedValue(200000n),
        },
        interface: {
          encodeFunctionData: vi.fn().mockReturnValue('0x1234567890abcdef'),
        },
      }));
      (Wallet as any).mockImplementation(() => ({
        getNonce: vi.fn().mockResolvedValue(1),
        signTransaction: vi.fn().mockResolvedValue('0xsignedtx123'),
      }));

      const result = await executeOpportunity(
        mockOpportunity,
        mockSimulationResult,
        contextWithoutRelay,
        mockProvider,
        { dryRun: false, privateKey: '0x1234567890123456789012345678901234567890123456789012345678901234' }
      );

      expect(result.status).toBe('success');
      expect(result.txHash).toBe('0xtxhash123');
      expect(result.gasUsed).toBe(BigInt('180000'));
      expect(result.relayUsed).toBe(false);
      expect(mockProvider.send).toHaveBeenCalledWith('eth_sendRawTransaction', ['0xsignedtx123']);
    });

    it('should use private relay when configured', async () => {
      (global.fetch as any).mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          result: '0xtxhash456',
        }),
      });

      // Ensure reasonable gas estimate and wallet signing
      const { Contract, Wallet } = await import('ethers');
      (Contract as any).mockImplementation(() => ({
        executeOperation: {
          estimateGas: vi.fn().mockResolvedValue(200000n),
        },
        interface: {
          encodeFunctionData: vi.fn().mockReturnValue('0x1234567890abcdef'),
        },
      }));
      (Wallet as any).mockImplementation(() => ({
        getNonce: vi.fn().mockResolvedValue(1),
        signTransaction: vi.fn().mockResolvedValue('0xsignedtx456'),
      }));

      const result = await executeOpportunity(
        mockOpportunity,
        mockSimulationResult,
        mockContext,
        mockProvider,
        { dryRun: false, privateKey: '0x1234567890123456789012345678901234567890123456789012345678901234' }
      );

      expect(result.status).toBe('success');
      expect(result.txHash).toBe('0xtxhash456');
      expect(result.relayUsed).toBe(true);
    });

    it('should handle transaction revert', async () => {
      // Ensure reasonable gas estimate to avoid gas guard
      const { Contract } = await import('ethers');
      (Contract as any).mockImplementation(() => ({
        executeOperation: {
          estimateGas: vi.fn().mockResolvedValue(200000n),
        },
        interface: {
          encodeFunctionData: vi.fn().mockReturnValue('0x1234567890abcdef'),
        },
      }));

      mockProvider.waitForTransaction.mockResolvedValue({
        status: 0,
        gasUsed: BigInt('150000'),
      });

      const result = await executeOpportunity(
        mockOpportunity,
        mockSimulationResult,
        mockContext,
        mockProvider,
        { dryRun: false, privateKey: '0x1234567890123456789012345678901234567890123456789012345678901234' }
      );

      expect(result.status).toBe('reverted');
      expect(result.revertReason).toBe('transaction-reverted');
    });

    it('should handle transaction timeout', async () => {
      // Ensure reasonable gas estimate to avoid gas guard
      const { Contract } = await import('ethers');
      (Contract as any).mockImplementation(() => ({
        executeOperation: {
          estimateGas: vi.fn().mockResolvedValue(200000n),
        },
        interface: {
          encodeFunctionData: vi.fn().mockReturnValue('0x1234567890abcdef'),
        },
      }));

      mockProvider.waitForTransaction.mockResolvedValue(undefined);

      const result = await executeOpportunity(
        mockOpportunity,
        mockSimulationResult,
        mockContext,
        mockProvider,
        { dryRun: false, privateKey: '0x1234567890123456789012345678901234567890123456789012345678901234' }
      );

      expect(result.status).toBe('reverted');
      expect(result.revertReason).toBe('transaction-timeout');
    });

    it('should require private key for real execution', async () => {
      // Ensure reasonable gas estimate to avoid gas guard
      const { Contract } = await import('ethers');
      (Contract as any).mockImplementation(() => ({
        executeOperation: {
          estimateGas: vi.fn().mockResolvedValue(200000n),
        },
        interface: {
          encodeFunctionData: vi.fn().mockReturnValue('0x1234567890abcdef'),
        },
      }));

      const result = await executeOpportunity(
        mockOpportunity,
        mockSimulationResult,
        mockContext,
        mockProvider,
        { dryRun: false }
      );

      expect(result.status).toBe('blocked');
      expect(result.revertReason).toBe('missing-private-key');
    });
  });

  describe('Error Handling', () => {
    it('should handle execution errors gracefully', async () => {
      const { Contract } = await import('ethers');
      (Contract as any).mockImplementation(() => {
        throw new Error('Contract error');
      });

      const result = await executeOpportunity(
        mockOpportunity,
        mockSimulationResult,
        mockContext,
        mockProvider,
        { dryRun: true }
      );

      expect(result.status).toBe('reverted');
      expect(result.revertReason).toBe('Contract error');
    });
  });
});