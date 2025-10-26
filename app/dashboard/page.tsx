import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function Dashboard() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect('/sign-in');
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-content">
        <div className="dashboard-card">
          <h1 className="dashboard-title">
            Welcome to Your Dashboard
          </h1>
          <p className="dashboard-subtitle">
            This is a protected page. Only authenticated users can access this content.
          </p>
          
          <div className="dashboard-grid">
            <div className="dashboard-feature-card blue">
              <h3 className="dashboard-feature-title blue">
                Mock Interviews
              </h3>
              <p className="dashboard-feature-description blue">Start a new AI-powered interview session</p>
              <button className="dashboard-btn blue">
                Start Interview
              </button>
            </div>
            
            <div className="dashboard-feature-card green">
              <h3 className="dashboard-feature-title green">
                Progress Tracking
              </h3>
              <p className="dashboard-feature-description green">View your interview performance history</p>
              <button className="dashboard-btn green">
                View Progress
              </button>
            </div>
            
            <div className="dashboard-feature-card purple">
              <h3 className="dashboard-feature-title purple">
                Feedback Reports
              </h3>
              <p className="dashboard-feature-description purple">Access detailed feedback from your sessions</p>
              <button className="dashboard-btn purple">
                View Reports
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}