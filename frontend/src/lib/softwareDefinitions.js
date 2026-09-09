import {
  Share2,
  MessageSquare,
  Webhook,
  PhoneCall,
  Bot,
  FileSearch,
  HeartHandshake
} from 'lucide-react';

/**
 * Canonical client software definitions matching backend SOFTWARE_FEATURE_REGISTRY.
 */
export const SOFTWARE_DEFINITIONS = [
  {
    code: 'SOCIAL_MEDIA_MANAGER',
    name: 'Social Media Manager',
    path: '/client/social-manager',
    icon: Share2,
    badge: 'Social'
  },
  {
    code: 'WHATSAPP_CAMPAIGN',
    name: 'WhatsApp Campaign',
    path: '/client/whatsapp',
    icon: MessageSquare,
    badge: 'Campaigns'
  },
  {
    code: 'WHATSHOOK',
    name: 'WhatsHook',
    path: '/client/whatshook',
    icon: Webhook,
    badge: 'Webhooks'
  },
  {
    code: 'AI_CALLING',
    name: 'AI Calling',
    path: '/client/ai-calling',
    icon: PhoneCall,
    badge: 'Voice'
  },
  {
    code: 'CHATBOT',
    name: 'ChatBot',
    path: '/client/chatbot',
    icon: Bot,
    badge: 'Automation'
  },
  {
    code: 'DATEXT',
    name: 'Datext',
    path: '/client/datext',
    icon: FileSearch,
    badge: 'Extraction'
  },
  {
    code: 'SHARE_AND_CARE',
    name: 'Share & Care',
    path: '/client/share-care',
    icon: HeartHandshake,
    badge: 'Community'
  }
];
