import { NavLink } from 'react-router-dom';

const linkBase = 'px-3 py-2 rounded text-sm';
const active = 'bg-slate-800 text-cyan-400';
const normal = 'text-slate-300 hover:text-cyan-300 hover:bg-slate-800';

export const Sidebar = () => (
  <aside className="w-56 border-r border-slate-800 bg-slate-900 h-[calc(100vh-56px)] p-3">
    <nav className="flex flex-col gap-1">
      <NavLink to="/" className={({ isActive }) => `${linkBase} ${isActive ? active : normal}`}>Home</NavLink>
      <NavLink to="/opportunities" className={({ isActive }) => `${linkBase} ${isActive ? active : normal}`}>Opportunità</NavLink>
      <NavLink to="/simulation" className={({ isActive }) => `${linkBase} ${isActive ? active : normal}`}>Simulazione</NavLink>
      <NavLink to="/history" className={({ isActive }) => `${linkBase} ${isActive ? active : normal}`}>Storico</NavLink>
      <NavLink to="/settings" className={({ isActive }) => `${linkBase} ${isActive ? active : normal}`}>Impostazioni</NavLink>
    </nav>
  </aside>
);