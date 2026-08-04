from abc import ABC, abstractmethod

class TierLimitPolicy(ABC):
    """Abstract Base Class for Subscription Tiers"""
    
    @abstractmethod
    def max_posts_allowed(self) -> int:
        pass
        
    @abstractmethod
    def max_publishes_allowed(self) -> int:
        pass
        
    def can_create_post(self, current_posts_count: int) -> bool:
        return current_posts_count < self.max_posts_allowed()
        
    def can_publish_post(self, current_publish_count: int) -> bool:
        return current_publish_count < self.max_publishes_allowed()

class FreeTierPolicy(TierLimitPolicy):
    def max_posts_allowed(self) -> int:
        return 5
        
    def max_publishes_allowed(self) -> int:
        return 1

class StarterTierPolicy(TierLimitPolicy):
    def max_posts_allowed(self) -> int:
        return 15
        
    def max_publishes_allowed(self) -> int:
        return 3

class CreatorTierPolicy(TierLimitPolicy):
    def max_posts_allowed(self) -> int:
        return 50
        
    def max_publishes_allowed(self) -> int:
        return 10

class ProTierPolicy(TierLimitPolicy):
    def max_posts_allowed(self) -> int:
        return 200
        
    def max_publishes_allowed(self) -> int:
        return 50

def get_tier_policy(tier_name: str) -> TierLimitPolicy:
    """Factory function to get the appropriate policy based on tier string."""
    tier_upper = tier_name.upper()
    if tier_upper == 'PRO':
        return ProTierPolicy()
    elif tier_upper == 'CREATOR':
        return CreatorTierPolicy()
    elif tier_upper == 'STARTER':
        return StarterTierPolicy()
    # Default to free
    return FreeTierPolicy()
