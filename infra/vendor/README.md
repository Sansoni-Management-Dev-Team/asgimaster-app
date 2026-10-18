# vendor

`devops-terraform-modules.bundle` is a git bundle of Sansoni's private `devops-terraform-modules` repository, with every tag up to `0.0.24`. It was made on 18 October 2026 from a local clone at commit `6523ea6`.

The infra workflow uses it only when the `TF_MODULES_PAT` secret is empty. We lost read access to the modules repository, so a token from our accounts cannot read it. Once Rodney adds the secret, the workflow reads the modules from GitHub again and this bundle can be deleted, together with the fallback in `.github/workflows/infra.yml`.

A unit that pins a tag newer than `0.0.24` needs the token, or a new bundle.
