import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export function useOnboardingCheck() {
  const navigate = useNavigate();

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        await axios.get('http://localhost:8000/api/workspaces/profile/');
      } catch (error) {
        if (error.response?.data?.onboarding_required) {
          navigate('/onboarding');
        }
      }
    };
    checkOnboarding();
  }, [navigate]);
}
