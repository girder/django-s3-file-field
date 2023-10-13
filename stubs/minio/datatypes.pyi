from datetime import datetime

class Object:
    @property
    def bucket_name(self) -> str: ...
    @property
    def object_name(self) -> str: ...
    @property
    def is_dir(self) -> bool: ...
    @property
    def last_modified(self) -> datetime | None: ...
    @property
    def etag(self) -> str | None: ...
    @property
    def size(self) -> int | None: ...
    @property
    def metadata(self) -> Optional[Mapping[str, Any]]: ...
    @property
    def version_id(self) -> str | None: ...
    @property
    def is_latest(self) -> bool | None: ...
    @property
    def storage_class(self) -> str | None: ...
    @property
    def owner_id(self) -> str | None: ...
    @property
    def owner_name(self) -> str | None: ...
    @property
    def is_delete_marker(self) -> bool: ...
    @property
    def content_type(self) -> str | None: ...