import Sidebar from './Sidebar';
import { useNavigate } from 'react-router-dom';

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  return (
    <div className="dashboard">
      <Sidebar navigate={navigate} />
      <div className="page-content">{children}</div>
    </div>
  );
}
