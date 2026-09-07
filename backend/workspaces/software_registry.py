"""
Stage 10.1 — Canonical Software and Feature Hierarchy Registry.

Maps platform products/software modules to their constituent features and granular actions.
This canonical registry powers:
1. Entitlement-aware permission calculation
2. Role creation and modification validation
3. Workspace custom role enforcement
"""

SOFTWARE_FEATURE_REGISTRY = {
    "WHATSAPP_CAMPAIGN": {
        "code": "WHATSAPP_CAMPAIGN",
        "name": "WhatsApp Campaign",
        "features": {
            "CAMPAIGNS": {
                "code": "CAMPAIGNS",
                "name": "Campaigns",
                "actions": ["VIEW", "CREATE", "UPDATE", "DELETE", "SEND"]
            },
            "CONTACTS": {
                "code": "CONTACTS",
                "name": "Contacts & Audiences",
                "actions": ["VIEW", "CREATE", "UPDATE", "DELETE"]
            },
            "TEMPLATES": {
                "code": "TEMPLATES",
                "name": "Message Templates",
                "actions": ["VIEW", "CREATE", "UPDATE", "DELETE"]
            }
        }
    },
    "WHATSHOOK": {
        "code": "WHATSHOOK",
        "name": "WhatsHook",
        "features": {
            "WEBHOOKS": {
                "code": "WEBHOOKS",
                "name": "Incoming & Outgoing Webhooks",
                "actions": ["VIEW", "CREATE", "UPDATE", "DELETE", "TEST"]
            },
            "LOGS": {
                "code": "LOGS",
                "name": "Event Logs",
                "actions": ["VIEW", "EXPORT"]
            }
        }
    },
    "AI_CALLING": {
        "code": "AI_CALLING",
        "name": "AI Calling",
        "features": {
            "CALL_SESSIONS": {
                "code": "CALL_SESSIONS",
                "name": "Voice Sessions & Agents",
                "actions": ["VIEW", "CREATE", "UPDATE", "DELETE", "EXECUTE"]
            },
            "RECORDINGS": {
                "code": "RECORDINGS",
                "name": "Call Recordings & Transcripts",
                "actions": ["VIEW", "DOWNLOAD", "DELETE"]
            }
        }
    },
    "CHATBOT": {
        "code": "CHATBOT",
        "name": "ChatBot",
        "features": {
            "BOT_FLOWS": {
                "code": "BOT_FLOWS",
                "name": "Bot Automation Flows",
                "actions": ["VIEW", "CREATE", "UPDATE", "DELETE", "DEPLOY"]
            },
            "CONVERSATIONS": {
                "code": "CONVERSATIONS",
                "name": "Live Conversations",
                "actions": ["VIEW", "RESPOND", "ASSIGN"]
            }
        }
    },
    "DATEXT": {
        "code": "DATEXT",
        "name": "Datext",
        "features": {
            "EXTRACTION": {
                "code": "EXTRACTION",
                "name": "Data & Text Extraction",
                "actions": ["VIEW", "EXECUTE", "EXPORT"]
            },
            "RULES": {
                "code": "RULES",
                "name": "Parsing Rules",
                "actions": ["VIEW", "CREATE", "UPDATE", "DELETE"]
            }
        }
    },
    "SOCIAL_MEDIA_MANAGER": {
        "code": "SOCIAL_MEDIA_MANAGER",
        "name": "Social Media Manager",
        "features": {
            "POSTS": {
                "code": "POSTS",
                "name": "Posts",
                "actions": ["VIEW", "CREATE", "UPDATE", "DELETE", "PUBLISH"]
            },
            "SCHEDULING": {
                "code": "SCHEDULING",
                "name": "Content Scheduling",
                "actions": ["VIEW", "CREATE", "UPDATE", "DELETE"]
            },
            "ANALYTICS": {
                "code": "ANALYTICS",
                "name": "Performance Analytics",
                "actions": ["VIEW", "EXPORT"]
            }
        }
    },
    "SHARE_AND_CARE": {
        "code": "SHARE_AND_CARE",
        "name": "Share & Care",
        "features": {
            "COMMUNITY": {
                "code": "COMMUNITY",
                "name": "Community Programs",
                "actions": ["VIEW", "CREATE", "UPDATE", "DELETE", "ENGAGE"]
            },
            "RESOURCES": {
                "code": "RESOURCES",
                "name": "Shared Resources",
                "actions": ["VIEW", "CREATE", "UPDATE", "DELETE"]
            }
        }
    }
}


def get_available_software_for_workspace(workspace):
    """
    Returns the list of software modules and constituent features/actions entitled to the given workspace.
    Determined via the workspace's active Subscription and PlanEntitlements.

    If subscription is missing or not in an active/trialing state, returns empty list.
    """
    from payments.models import Subscription, PlanEntitlement

    try:
        subscription = Subscription.objects.select_related('plan').get(workspace=workspace)
    except Subscription.DoesNotExist:
        return []

    if subscription.status not in ['ACTIVE', 'TRIALING']:
        return []

    # Query active entitlements for the plan
    entitlements = PlanEntitlement.objects.filter(
        plan=subscription.plan,
        enabled=True
    ).values_list('feature_code', flat=True)

    entitled_set = set(entitlements)

    available_software = []

    for software_code, software_info in SOFTWARE_FEATURE_REGISTRY.items():
        # Check if the software itself is enabled, or any of its features
        has_software_entitlement = software_code in entitled_set
        
        entitled_features = []
        for feature_code, feature_info in software_info["features"].items():
            # Feature is entitled if:
            # 1. Whole software module code is in entitlements (e.g. WHATSAPP_CAMPAIGN), OR
            # 2. Specific feature code is in entitlements (e.g. CAMPAIGNS or WHATSAPP_CAMPAIGN.CAMPAIGNS)
            if (has_software_entitlement or 
                feature_code in entitled_set or 
                f"{software_code}.{feature_code}" in entitled_set):
                entitled_features.append({
                    "code": feature_info["code"],
                    "name": feature_info["name"],
                    "actions": list(feature_info["actions"])
                })

        if entitled_features:
            available_software.append({
                "code": software_info["code"],
                "name": software_info["name"],
                "features": entitled_features
            })

    return available_software


def validate_permissions_against_workspace(workspace, permissions_list):
    """
    Validates that a list of requested permissions (e.g. [{'software': 'WHATSAPP_CAMPAIGN', 'feature': 'CAMPAIGNS', 'actions': ['VIEW']}])
    or dotted strings (e.g. ['WHATSAPP_CAMPAIGN.CAMPAIGNS.VIEW']) are strictly entitled to the workspace.

    Returns (is_valid: bool, error_message: str | None, cleaned_permissions: list)
    """
    available_software = get_available_software_for_workspace(workspace)

    # Build lookup map of available software -> features -> actions
    allowed_map = {}
    for sw in available_software:
        allowed_map[sw["code"]] = {}
        for feat in sw["features"]:
            allowed_map[sw["code"]][feat["code"]] = set(feat["actions"])

    cleaned_permissions = []

    if not isinstance(permissions_list, list):
        return False, "Permissions must be a list", []

    for entry in permissions_list:
        if isinstance(entry, dict):
            sw_code = entry.get("software")
            feat_code = entry.get("feature")
            actions = entry.get("actions", [])

            if not sw_code or not feat_code or not actions:
                return False, "Each permission entry must contain software, feature, and actions", []

            # 1. Check software entitlement
            if sw_code not in allowed_map:
                return False, f"Software '{sw_code}' is not entitled for this workspace subscription.", []

            # 2. Check feature entitlement
            if feat_code not in allowed_map[sw_code]:
                return False, f"Feature '{feat_code}' under software '{sw_code}' is not entitled for this workspace.", []

            # 3. Check actions validity
            allowed_actions = allowed_map[sw_code][feat_code]
            for act in actions:
                if act not in allowed_actions:
                    return False, f"Action '{act}' is invalid for feature '{feat_code}' in software '{sw_code}'.", []

            # Preserve deterministic action order
            seen_actions = []
            for a in actions:
                if a not in seen_actions:
                    seen_actions.append(a)

            cleaned_permissions.append({
                "software": sw_code,
                "feature": feat_code,
                "actions": seen_actions
            })

        elif isinstance(entry, str):
            # Parse dotted format: "SOFTWARE.FEATURE.ACTION"
            parts = entry.split(".")
            if len(parts) != 3:
                return False, f"Invalid permission format: '{entry}'. Expected 'SOFTWARE.FEATURE.ACTION'.", []

            sw_code, feat_code, action = parts[0], parts[1], parts[2]

            if sw_code not in allowed_map:
                return False, f"Software '{sw_code}' is not entitled for this workspace subscription.", []

            if feat_code not in allowed_map[sw_code]:
                return False, f"Feature '{feat_code}' under software '{sw_code}' is not entitled for this workspace.", []

            if action not in allowed_map[sw_code][feat_code]:
                return False, f"Action '{action}' is invalid for feature '{feat_code}' in software '{sw_code}'.", []

            # Find or create group in cleaned_permissions
            existing = next((p for p in cleaned_permissions if p["software"] == sw_code and p["feature"] == feat_code), None)
            if existing:
                if action not in existing["actions"]:
                    existing["actions"].append(action)
            else:
                cleaned_permissions.append({
                    "software": sw_code,
                    "feature": feat_code,
                    "actions": [action]
                })
        else:
            return False, "Invalid permission entry format", []

    return True, None, cleaned_permissions
