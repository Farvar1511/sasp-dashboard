import Sidebar from './Sidebar';
import { useNavigate } from 'react-router-dom';

export default function Layout({ children, user }: { children: React.ReactNode; user: any }) {
  const navigate = useNavigate();

  return (
    <div className="dashboard">
      <Sidebar navigate={navigate} user={user} />
      <div className="page-content">{children}</div>
    </div>
  );
}
