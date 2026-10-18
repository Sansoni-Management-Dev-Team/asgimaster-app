# keys/

Drop each dev's SSH **public** key in this folder as a separate `.pub` file, e.g.:

```
keys/
  alice.pub
  bob.pub
```

Every `*.pub` file found here is baked into every bastion instance's `authorized_keys` via `user_data` on launch (see `main.tf`). There is no `aws_key_pair` resource and no private key material ever passes through Terraform or this repo.

To grant or revoke access: add or remove a file here and re-apply. Removing a key only takes effect on instance replacement (new `user_data` doesn't retroactively rewrite `authorized_keys` on a running instance) — terminate and recreate the affected instance, or manage removal out-of-band via SSH, to revoke immediately.

Never commit a private key (no `.pem`, no file without a `.pub` extension) to this folder.
