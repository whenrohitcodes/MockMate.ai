import { SignUp } from '@clerk/nextjs';

export default function Page() {
  return (
    <div className="auth-container">
      <div className="auth-content">
        <SignUp 
          appearance={{
            elements: {
              formButtonPrimary: 
                'bg-blue-600 hover:bg-blue-700 text-sm normal-case',
            },
          }}
        />
      </div>
    </div>
  );
}