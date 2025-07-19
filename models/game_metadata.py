"""
GameMetadata model - placeholder for TDD cycle.
This file intentionally incomplete to make tests fail initially.
"""
from enum import Enum

class FetchStatus(Enum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    NOT_FOUND = "not_found"

class GameMetadata:
    pass