# Clear Sftp Files Action

This action upload files to artifact and delete files from remote server.

## Inputs

### `host`

**Required** The host of the remote server.

### `port`

**Required** The port of the remote server.

### `username`

**Required** The username of the remote server.

### `password`

**Required** The password of the remote server.

### `file-patterns`

**Required** The file patterns to download from the remote server, separated by commas. Default is ``.
Example: `^registry.*\.json$,^package.*\.json$`

### `remote-dir-path`

**Required** The remote directory path to download files from.

### `fail-if-no-files`

Whether to fail if files are not found. Default is `'false'`. To Activate, set to `'true'`.

### `artifact-name`

The name of the artifact to upload the files to. Default is `cleared-files`.

## Outputs

### `filenames`

The filenames that were attempted to be downloaded. Separated by commas.

## Example usage

```yaml
uses: actions/download-sftp-files@v1
with:
  host: 'example.com'
  port: '22'
  username: 'user'
  password: 'password'
  file-patterns: '^registry.*\.json$,^package.*\.json$'
  remote-dir-path: '/path/to/remote/dir'
  fail-if-no-files: 'true'
  artifact-name: 'backup'
```
