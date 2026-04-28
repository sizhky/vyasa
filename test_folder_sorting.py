from vyasa.helpers import _normalize_vyasa_config, _sort_vyasa_entries


def test_created_sort_mode_is_allowed():
    config = _normalize_vyasa_config({"sort": "created_asc"})

    assert config["sort"] == "created_asc"


def test_created_sort_uses_birthtime_when_available():
    class Stat:
        def __init__(self, birthtime):
            self.st_birthtime = birthtime
            self.st_ctime = 99

    class Item:
        def __init__(self, name, birthtime):
            self.name = name
            self._birthtime = birthtime

        def stat(self):
            return Stat(self._birthtime)

        def is_dir(self):
            return False

    items = [Item("new.md", 2), Item("old.md", 1)]

    assert [item.name for item in _sort_vyasa_entries(items, "created_asc", False)] == ["old.md", "new.md"]
