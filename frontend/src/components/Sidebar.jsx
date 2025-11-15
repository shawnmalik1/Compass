import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/upload', label: 'Upload' },
  { to: '/graph', label: 'Graph' },
  { to: '/insights', label: 'Insights' },
];

function Sidebar() {
  return (
    <aside className="hidden w-60 flex-col border-r border-slate-900 bg-slate-950/80 px-4 py-6 md:flex">
      <div className="mb-8 text-xl font-bold tracking-tight text-compass-primary">
        Research Compass
      </div>
      <nav className="space-y-2 text-sm uppercase text-slate-400">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `block rounded-xl px-4 py-3 transition ${
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'hover:bg-slate-900/40 hover:text-white'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
