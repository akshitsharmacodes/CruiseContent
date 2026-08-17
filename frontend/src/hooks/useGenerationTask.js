import { useState, useEffect } from 'react';
import useApi from './useApi';
import { toast } from 'sonner';

export function useGenerationTask() {
  const api = useApi();
  const [taskId, setTaskId] = useState(null);
  const [status, setStatus] = useState('Idle');
  const [generatedContent, setGeneratedContent] = useState({});

  const startGeneration = async (inputType, inputData, platforms, userImagePrompt = '', generateImage = true) => {
    try {
      setStatus('Pending');
      setGeneratedContent({});
      const response = await api.post('generate/', {
        input_type: inputType,
        input_data: inputData,
        platforms,
        user_image_prompt: userImagePrompt,
        generate_image: generateImage
      });
      setTaskId(response.data.task_id);
    } catch (error) {
      setStatus('Idle');
      const errMessage = error.response?.data?.error || error.message;
      toast.error(`Failed to start generation: ${errMessage}`);
    }
  };

  useEffect(() => {
    let interval;
    if (taskId && (status === 'Pending' || status === 'Processing')) {
      interval = setInterval(async () => {
        try {
          const response = await api.get(`generate/${taskId}/`);
          const taskData = response.data;
          setStatus(taskData.status);
          
          if (taskData.status === 'Completed') {
            setGeneratedContent(taskData.generated_content);
            if (taskData.generated_content.image_error) {
              toast.warning(`Text generated, but image generation failed: ${taskData.generated_content.image_error}`, { duration: 8000 });
            } else {
              toast.success('Generation completed successfully!');
            }
            clearInterval(interval);
          } else if (taskData.status === 'Failed') {
            toast.error(taskData.error_message || 'Task failed on the server.');
            clearInterval(interval);
          }
        } catch (error) {
          clearInterval(interval);
          setStatus('Failed');
          const errMessage = error.response?.data?.error || error.message;
          toast.error(`Polling Error: ${errMessage}`);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [taskId, status]);

  const updateContent = (platform, value) => {
    setGeneratedContent(prev => ({
      ...prev,
      [platform]: value
    }));
  };

  const publishContent = async (platform, scheduledFor) => {
    try {
      const response = await api.post('platform/publish/', {
        platform: platform,
        content: generatedContent.texts ? generatedContent.texts[platform] : generatedContent[platform],
        image_url: generatedContent.image_url,
        scheduled_for: scheduledFor
      });
      
      const postId = response.data.post_id;
      const initialStatus = response.data.status;

      if (initialStatus === 'SCHEDULED') {
        toast.success(`Successfully scheduled for ${platform}!`);
        return Promise.resolve();
      }
      
      return new Promise((resolve, reject) => {
        const interval = setInterval(async () => {
          try {
            const statusRes = await api.get(`platform/publish/status/${postId}/`);
            const postStatus = statusRes.data.status;
            
            if (postStatus === 'SUCCESS') {
              clearInterval(interval);
              toast.success(`Successfully published to ${platform}!`);
              resolve();
            } else if (postStatus === 'FAILED') {
              clearInterval(interval);
              const err = statusRes.data.error_message || 'Publish failed in background.';
              toast.error(`Publish Error: ${err}`);
              reject(new Error(err));
            }
            // If PENDING or PROCESSING, continue polling
          } catch (e) {
            clearInterval(interval);
            const errMessage = e.response?.data?.error || e.message;
            toast.error(`Publish Status Error: ${errMessage}`);
            reject(e);
          }
        }, 2000);
      });
      
    } catch (error) {
      const errMessage = error.response?.data?.error || error.message;
      toast.error(`Publish Error: ${errMessage}`);
      throw error;
    }
  };

  const regeneratePlatform = async (platform, inputType, inputData) => {
    try {
      const response = await api.post('generate/', {
        input_type: inputType,
        input_data: inputData,
        platforms: [platform]
      });
      const newTaskId = response.data.task_id;
      
      return new Promise((resolve, reject) => {
        const interval = setInterval(async () => {
          try {
            const res = await api.get(`generate/${newTaskId}/`);
            if (res.data.status === 'Completed') {
              clearInterval(interval);
              const newContent = res.data.generated_content?.texts?.[platform] || res.data.generated_content?.[platform];
              
              // Update global state with the new content for this platform
              setGeneratedContent(prev => {
                const isNested = !!prev.texts;
                if (isNested) {
                  return { ...prev, texts: { ...prev.texts, [platform]: newContent } };
                }
                return { ...prev, [platform]: newContent };
              });
              
              resolve(newContent);
            } else if (res.data.status === 'Failed') {
              clearInterval(interval);
              reject(new Error(res.data.error_message || 'Regeneration failed'));
            }
          } catch (e) {
            clearInterval(interval);
            reject(e);
          }
        }, 3000);
      });
    } catch (error) {
      throw error;
    }
  };

  return {
    status,
    generatedContent,
    startGeneration,
    updateContent,
    publishContent,
    regeneratePlatform
  };
}
