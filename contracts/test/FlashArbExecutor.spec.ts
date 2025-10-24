import { ethers } from 'hardhat';
import { expect } from 'chai';

describe('FlashArbExecutor', () => {
  it('deploys and owner can pause/unpause', async () => {
    const [owner] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory('FlashArbExecutor');
    const c = await Factory.deploy(owner.address);
    await c.waitForDeployment();

    expect(await c.owner()).to.eq(owner.address);

    await (await c.pause()).wait();
    await (await c.unpause()).wait();
  });

  it('reverts on deadline expired', async () => {
    const [owner, initiator] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory('FlashArbExecutor');
    const c = await Factory.deploy(owner.address);
    await c.waitForDeployment();

    const assets: string[] = [];
    const amounts = [ethers.parseEther('1')];
    const premiums = [ethers.parseEther('0.01')];

    const params = ethers.AbiCoder.defaultAbiCoder().encode(
      ['tuple(uint256,uint256,uint256)', 'uint256'],
      [
        [Math.floor(Date.now() / 1000) - 1, ethers.parseEther('1'), 30],
        ethers.parseEther('2'),
      ],
    );

    await expect(
      c.executeOperation(assets, amounts, premiums, initiator.address, params),
    ).to.be.revertedWith('deadline-expired');
  });

  it('passes when repay covered and minAmountOut satisfied', async () => {
    const [owner, initiator] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory('FlashArbExecutor');
    const c = await Factory.deploy(owner.address);
    await c.waitForDeployment();

    const assets: string[] = [];
    const amounts = [ethers.parseEther('1')];
    const premiums = [ethers.parseEther('0.01')];

    const deadline = Math.floor(Date.now() / 1000) + 60;
    const params = ethers.AbiCoder.defaultAbiCoder().encode(
      ['tuple(uint256,uint256,uint256)', 'uint256'],
      [[deadline, ethers.parseEther('1.5'), 30], ethers.parseEther('2')],
    );

    const ok = await c.executeOperation.staticCall(assets, amounts, premiums, initiator.address, params);
    expect(ok).to.equal(true);
  });

  it('emits Executed on success', async () => {
    const [owner, initiator] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory('FlashArbExecutor');
    const c = await Factory.deploy(owner.address);
    await c.waitForDeployment();

    const assets: string[] = [];
    const amounts = [ethers.parseEther('1')];
    const premiums = [ethers.parseEther('0.01')];

    const deadline = Math.floor(Date.now() / 1000) + 60;
    const expectedOut = ethers.parseEther('2');
    const params = ethers.AbiCoder.defaultAbiCoder().encode(
      ['tuple(uint256,uint256,uint256)', 'uint256'],
      [[deadline, ethers.parseEther('1.5'), 30], expectedOut],
    );

    const repay = amounts[0] + premiums[0];
    const profit = expectedOut - repay;

    await expect(
      c.executeOperation(assets, amounts, premiums, initiator.address, params),
    )
      .to.emit(c, 'Executed')
      .withArgs(initiator.address, profit, params);
  });

  it('emits Simulated and Reverted on simulate with expired deadline', async () => {
    const [owner, initiator] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory('FlashArbExecutor');
    const c = await Factory.deploy(owner.address);
    await c.waitForDeployment();

    const assets: string[] = [];
    const amounts = [ethers.parseEther('1')];
    const premiums = [ethers.parseEther('0.01')];

    const expectedOut = ethers.parseEther('2');
    const params = ethers.AbiCoder.defaultAbiCoder().encode(
      ['tuple(uint256,uint256,uint256)', 'uint256'],
      [[Math.floor(Date.now() / 1000) - 1, ethers.parseEther('1.5'), 30], expectedOut],
    );

    await expect(
      c.simulateOperation(assets, amounts, premiums, initiator.address, params),
    )
      .to.emit(c, 'Simulated')
      .withArgs(initiator.address, amounts[0], expectedOut)
      .and.to.emit(c, 'Reverted')
      .withArgs(initiator.address, 'deadline-expired');

    const ok = await c.simulateOperation.staticCall(assets, amounts, premiums, initiator.address, params);
    expect(ok).to.equal(false);
  });

  it('only owner can pause/unpause and paused blocks with custom error', async () => {
    const [owner, other, initiator] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory('FlashArbExecutor');
    const c = await Factory.deploy(owner.address);
    await c.waitForDeployment();

    await expect(c.connect(other).pause()).to.be.reverted; // RBAC enforced
    await expect(c.connect(other).unpause()).to.be.reverted; // RBAC enforced

    await (await c.pause()).wait();

    const assets: string[] = [];
    const amounts = [ethers.parseEther('1')];
    const premiums = [ethers.parseEther('0.01')];
    const deadline = Math.floor(Date.now() / 1000) + 60;
    const params = ethers.AbiCoder.defaultAbiCoder().encode(
      ['tuple(uint256,uint256,uint256)', 'uint256'],
      [[deadline, ethers.parseEther('1.5'), 30], ethers.parseEther('2')],
    );

    await expect(
      c.executeOperation(assets, amounts, premiums, initiator.address, params),
    ).to.be.revertedWithCustomError(c, 'PausedOrLossLimit');

    await (await c.unpause()).wait();
  });

  it('loss limit blocks execution and emits LossLimitTriggered', async () => {
    const [owner, initiator] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory('FlashArbExecutor');
    const c = await Factory.deploy(owner.address);
    await c.waitForDeployment();

    const today = Math.floor(Date.now() / 1000 / 86400);
    await (await c.setDailyLossLimitWei(ethers.parseEther('1'))).wait();
    await expect(c.recordLoss(today, ethers.parseEther('2')))
      .to.emit(c, 'LossLimitTriggered')
      .withArgs(today, ethers.parseEther('2'));

    const assets: string[] = [];
    const amounts = [ethers.parseEther('1')];
    const premiums = [ethers.parseEther('0.01')];
    const deadline = Math.floor(Date.now() / 1000) + 60;
    const params = ethers.AbiCoder.defaultAbiCoder().encode(
      ['tuple(uint256,uint256,uint256)', 'uint256'],
      [[deadline, ethers.parseEther('1.5'), 30], ethers.parseEther('2')],
    );

    await expect(
      c.executeOperation(assets, amounts, premiums, initiator.address, params),
    ).to.be.revertedWithCustomError(c, 'PausedOrLossLimit');
  });
});