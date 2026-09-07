import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../lib/api';

export function useOnboardingCheck() {
  const navigate = useNavigate();

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        await axios.get(`${API_BASE_URL}/api/workspaces/profile/`);
      } catch (error) {
        if (error.response?.data?.onboarding_required) {
          navigate('/onboarding');
        }
      }
    };
    checkOnboarding();
  }, [navigate]);
}
