import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from "@/components/ui/questionnaire"

const items = [
  {
    name: "business_name",
    required: true,
    prompt: "What is your business name?",
    description: "This will be the name of your first workspace.",
    input: { label: "Business Name", placeholder: "e.g. Acme Corp" },
  },
  {
    name: "owner_name",
    required: true,
    prompt: "What is your name?",
    description: "We'll use this to personalize your experience.",
    input: { label: "Your Name", placeholder: "e.g. John Doe" },
  },
  {
    name: "services_provided",
    required: true,
    prompt: "What services do you provide?",
    description: "Choose the category that best fits your business, or write your own.",
    choices: [
      { value: "b2b", label: "B2B Software / Services" },
      { value: "b2c", label: "B2C E-commerce / Retail" },
      { value: "agency", label: "Marketing / Creative Agency" },
    ],
    input: { label: "Other services", placeholder: "Type your services here..." },
  },
  {
    name: "physical_location_type",
    required: true,
    prompt: "Where do you operate?",
    description: "This helps the AI contextualize location-based posts.",
    choices: [
      { value: "Remote", label: "Remote / Online only" },
      { value: "Hybrid", label: "Hybrid" },
      { value: "Physical", label: "Physical Storefront / Office" }
    ],
  }
]

export default function Onboarding() {
  const { user, accessToken } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    
    const formData = new FormData(event.currentTarget);
    
    const payload = {
      business_name: formData.get("business_name") || "",
      owner_name: formData.get("owner_name") || "",
      services_provided: formData.get("services_provided") || "",
      physical_location_type: formData.get("physical_location_type") || "Remote",
      is_online_or_remote: formData.get("physical_location_type") !== "Physical"
    };

    try {
      const response = await fetch('http://localhost:8000/api/onboard/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        navigate('/dashboard', { replace: true });
      } else {
        console.error("Onboarding failed");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-xl bg-card p-8 rounded-xl shadow-lg border border-border overflow-hidden">
        
        <Questionnaire items={items} onSubmit={handleSubmit}>
          <QuestionnaireProgress className="mb-8" />
          
          {items.map((question) => (
            <QuestionnaireItem
              key={question.name}
              name={question.name}
              required={question.required}
              className="space-y-6"
            >
              <div className="space-y-2">
                <QuestionnaireTitle className="text-2xl font-bold">{question.prompt}</QuestionnaireTitle>
                <QuestionnaireDescription className="text-muted-foreground">
                  {question.description}
                </QuestionnaireDescription>
              </div>

              {question.choices || question.input ? (
                <QuestionnaireChoices className="grid gap-3">
                  {question.choices?.map((choice) => (
                    <QuestionnaireChoice 
                      key={choice.value} 
                      value={choice.value}
                      className="border border-border p-4 rounded-xl hover:bg-secondary transition-colors cursor-pointer flex items-center gap-3 data-[state=checked]:bg-primary/10 data-[state=checked]:border-primary"
                    >
                      <span className="font-medium text-foreground">{choice.label}</span>
                    </QuestionnaireChoice>
                  ))}
                  
                  {question.input ? (
                    <div className="mt-4">
                      <QuestionnaireInput
                        aria-label={question.input.label}
                        placeholder={question.input.placeholder}
                        className="flex h-12 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>
                  ) : null}
                </QuestionnaireChoices>
              ) : null}
              <QuestionnaireError className="text-destructive text-sm font-medium mt-2" />
            </QuestionnaireItem>
          ))}
          
          <QuestionnaireActions className="flex justify-between items-center mt-12 pt-6 border-t border-border">
            <QuestionnairePrevious className="px-6 py-2 border border-border rounded-full hover:bg-secondary text-sm font-medium transition-colors" />
            <div className="flex gap-3 ml-auto">
              <QuestionnaireNext className="px-6 py-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 text-sm font-medium transition-colors" />
              <QuestionnaireSubmit 
                disabled={loading}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 text-sm font-medium transition-colors disabled:opacity-50" 
              >
                {loading ? 'Submitting...' : 'Complete Setup'}
              </QuestionnaireSubmit>
            </div>
          </QuestionnaireActions>
        </Questionnaire>

      </div>
    </div>
  );
}
