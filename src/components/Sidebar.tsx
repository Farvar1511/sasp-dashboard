import { useState, useEffect } from 'react';

export default function Sidebar({ navigate, isAdmin, trooperProgress }: { navigate: (path: string) => void, isAdmin: boolean, trooperProgress?: { completed: number, goal: number } }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [goal, setGoal] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (isAdmin && trooperProgress) {
      setGoal(trooperProgress.goal);
      setProgress(trooperProgress.completed);
    }
  }, [isAdmin, trooperProgress]);

  const incrementGoal = () => setGoal((prev) => prev + 1);
  const decrementGoal = () => setGoal((prev) => (prev > 0 ? prev - 1 : 0));
  const incrementProgress = () => setProgress((prev) => (prev < goal ? prev + 1 : prev));
  const decrementProgress = () => setProgress((prev) => (prev > 0 ? prev - 1 : 0));

  return (
    <div className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
      <button className="button-primary" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
        {isSidebarCollapsed ? '☰' : 'Collapse'}
      </button>
      {!isSidebarCollapsed && (
        <>
          <button className="button-primary" onClick={() => navigate('/')}>Dashboard</button>
          <button className="button-primary" onClick={() => navigate('/tasks')}>Tasks</button>
          <button className="button-primary" onClick={() => navigate('/badge-lookup')}>Badge Lookup</button>

          {/* Progress Tracker */}
          <div className="progress-tracker">
            <h3>{isAdmin ? "Trooper Progress" : "Your Progress"}</h3>
            <div className="progress-bar">
              <div
                className="progress-bar-fill"
                style={{ width: `${(progress / (goal || 1)) * 100}%` }}
              ></div>
            </div>
            <p>
              {progress} / {goal} tasks completed
            </p>
            {!isAdmin && (
              <div className="progress-controls">
                <button onClick={incrementGoal}>⬆ Goal</button>
                <button onClick={decrementGoal}>⬇ Goal</button>
                <button onClick={incrementProgress}>⬆ Progress</button>
                <button onClick={decrementProgress}>⬇ Progress</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
