import re
import mistletoe as mst


def span_token(name, pat, attr, prec=5):
    class T(mst.span_token.SpanToken):
        precedence, parse_inner, parse_group, pattern = prec, False, 1, re.compile(pat)
        def __init__(self, match):
            setattr(self, attr, match.group(1))
            if hasattr(match, "lastindex") and match.lastindex and match.lastindex >= 2:
                if name == "YoutubeEmbed": self.caption = match.group(2) if match.group(2) else None
                elif name == "MermaidEmbed": self.option = match.group(2) if match.group(2) else None
                elif name == "IframeEmbed": self.options = match.group(2) if match.group(2) else None
                elif name == "DownloadEmbed": self.label = match.group(2) if match.group(2) else None
    T.__name__ = name
    return T


FootnoteRef = span_token("FootnoteRef", r"\[\^([^\]]+)\](?!:)", "target")
YoutubeEmbed = span_token("YoutubeEmbed", r"\[yt:([a-zA-Z0-9_-]+)(?:\|(.+))?\]", "video_id", 6)
IframeEmbed = span_token("IframeEmbed", r"\[iframe:([^\|\]]+)(?:\|(.+))?\]", "src", 6)
DownloadEmbed = span_token("DownloadEmbed", r"\[download:([^\|\]]+)(?:\|(.+))?\]", "path", 6)


class Superscript(mst.span_token.SpanToken):
    pattern = re.compile(r"(?<![\\\w$])\^([A-Za-z0-9.+\-]{1,32})\^(?![\w$])"); parse_inner = False; parse_group = 1; precedence = 7
    def __init__(self, match): self.content = match.group(1); self.children = []


class Subscript(mst.span_token.SpanToken):
    pattern = re.compile(r"(?<![~\\\w$])~([A-Za-z0-9.+\-]{1,32})~(?![~\w$])"); parse_inner = False; parse_group = 1; precedence = 7
    def __init__(self, match): self.content = match.group(1); self.children = []


class InlineCodeAttr(mst.span_token.SpanToken):
    pattern = re.compile(r"`([^`]+)`\{([^\}]+)\}"); parse_inner = False; parse_group = 1; precedence = 8
    def __init__(self, match): self.code = match.group(1); self.attrs = match.group(2); self.children = []


class Strikethrough(mst.span_token.SpanToken):
    pattern = re.compile(r"~~(.+?)~~"); parse_inner = True; parse_group = 1; precedence = 7
    def __init__(self, match): self.children = []
