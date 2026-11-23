from supabase import Client, create_client

from app.config import Settings


class SupabaseConfigurationError(RuntimeError):
    pass


def create_supabase_auth_client(settings: Settings) -> Client:
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise SupabaseConfigurationError("Supabase Auth configuration is missing.")
    return create_client(
        settings.supabase_url,
        settings.supabase_anon_key.get_secret_value(),
    )


def create_supabase_public_client(settings: Settings) -> Client:
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise SupabaseConfigurationError("Supabase public configuration is missing.")
    return create_client(
        settings.supabase_url,
        settings.supabase_anon_key.get_secret_value(),
    )


def create_supabase_admin_client(settings: Settings) -> Client:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise SupabaseConfigurationError("Supabase server configuration is missing.")
    return create_client(
        settings.supabase_url,
        settings.supabase_service_role_key.get_secret_value(),
    )


def create_supabase_client(settings: Settings) -> Client:
    """Compatibility alias for server-only operations requiring admin access."""
    return create_supabase_admin_client(settings)
