from ..extensions import ExtensionMeta, VyasaExtensionBase


class DefaultThemeExtension(VyasaExtensionBase):
    pass


EXTENSION = DefaultThemeExtension(ExtensionMeta("default_theme", "theme", ("slot:theme",)))
META = EXTENSION.meta

__all__ = ["EXTENSION", "META"]
