This folder stores uploaded files — property photos, lease documents, FICA documents.

Folder structure created automatically on first upload:
uploads/
  {tenant_id}/
    contact_doc/
      {contact_id}/
        [files]
    listing_photo/
      {listing_id}/
        [files]
    lease_doc/
      {lease_id}/
        [files]

This folder must be writable by the web server.
On the live VPS run: sudo chmod -R 755 uploads/
