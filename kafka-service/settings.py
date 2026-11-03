"""Environment settings for kafka-service."""

from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings


class KafkaSettings(BaseSettings):
    """Connection settings the Helm chart sets; the broker and topic come from System Config.

    Attributes:
        kafka_username: SASL user, from Secret defence-ops-kafka.
        kafka_password: SASL password, from the same Secret.
        kafka_security_protocol: How the broker expects clients to connect.
        kafka_sasl_mechanism: SASL mechanism for SASL_* protocols.
        kafka_ssl_cafile: CA bundle for SSL protocols; the system store when unset.
        max_stream_clients: Live alert streams served at once; each holds a consumer.
    """

    kafka_username: str | None = None
    kafka_password: SecretStr | None = None
    kafka_security_protocol: Literal["PLAINTEXT", "SSL", "SASL_PLAINTEXT", "SASL_SSL"] = (
        "SASL_PLAINTEXT"
    )
    kafka_sasl_mechanism: Literal["PLAIN", "SCRAM-SHA-256", "SCRAM-SHA-512"] = "PLAIN"
    kafka_ssl_cafile: str | None = None
    max_stream_clients: int = Field(default=20, ge=1)


@lru_cache
def get_settings() -> KafkaSettings:
    """Returns the settings, read once per process."""
    return KafkaSettings()
