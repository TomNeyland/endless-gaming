"""
Marshmallow schemas for discovery API request/response validation.

Contains schemas for validating and serializing data in the discovery API.
"""
from marshmallow import Schema, fields


class GameRecordSchema(Schema):
    """Schema for game record JSON response."""
    
    appId = fields.Integer(required=True)
    name = fields.String(required=True)
    coverUrl = fields.String(allow_none=True)
    price = fields.String(allow_none=True)
    developer = fields.String(allow_none=True)
    publisher = fields.String(allow_none=True)
    tags = fields.Dict(keys=fields.String(), values=fields.Integer())
    genres = fields.List(fields.String())
    reviewPos = fields.Integer(allow_none=True)
    reviewNeg = fields.Integer(allow_none=True)