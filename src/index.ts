import path from 'node:path'
import fs from 'node:fs'
import * as core from '@actions/core'
import {DefaultArtifactClient} from '@actions/artifact'

import { Client, type SFTPWrapper, type ConnectConfig } from 'ssh2'
import { type FileToDownload } from './types'

const remoteDirPath = core.getInput('remote-dir-path')
const host = core.getInput('host')
const port = +core.getInput('port')
const username = core.getInput('username')
const password = core.getInput('password')
const filePatterns = core.getInput('file-patterns')
const failIfNoFiles = core.getInput('fail-if-no-files') === 'true'
const artifactName = core.getInput('artifact-name') || 'cleared-files'

const artifact = new DefaultArtifactClient()

const filePatternsToDownload = filePatterns
  .split(',')
  .map(filePattern => filePattern.trim())
  .filter(filePattern => filePattern !== '')
  .map(filePattern => new RegExp(filePattern))

const credentials: ConnectConfig = {
  host,
  port,
  username,
  password,
}

console.log(`It will be attempted to download the files with the following patterns: ${filePatterns}`)

const executeAction = (conn: Client, sftp: SFTPWrapper, listToDownload: FileToDownload[], position: number) => {
  const item = listToDownload.at(position)
  if (!item) {
    // all files cleared
    console.log('All files cleared')
    conn.end()

    artifact.uploadArtifact(artifactName, listToDownload.map(file => file.localPath), '.')
      .then(res => {
        console.log('Artifact uploaded')
        // delete local files
        listToDownload.forEach(file => {
          fs.unlinkSync(file.localPath)
          console.log(`Deleted local file: ${file.localPath}`)
        })

        console.log('Local files deleted successfully ✅')
      })
      .catch(err => {
        console.error('Error uploading artifact', err)
        core.setFailed(err.message)
      })

    return
  }
  console.log(`Downloading ${item.remotePath} to ${item.localPath}`)

  // normal download
  sftp.fastGet(item.remotePath, item.localPath, errFastGet => {
    if (errFastGet) {
      console.log(`Error downloading file: ${item.remotePath} to ${item.localPath}`)
      conn.end()
      core.setFailed(errFastGet.message)
      throw errFastGet
    }
    console.log(`Downloaded to ${item.localPath}`)

    sftp.unlink(item.remotePath, errUnlink => {
      if (errUnlink) {
        console.log(`Error deleting file: ${item.remotePath}`)
        conn.end()
        core.setFailed(errUnlink.message)
        throw errUnlink
      }
      console.log(`Deleted file: ${item.remotePath}`)

      executeAction(conn, sftp, listToDownload, position + 1)
    })
  })

  // victor download method
  // sftp.readFile(remoteFile, (err, data) => {
  //   if (err) throw err
  //   fs.writeFile(localFile, data, (err) => {
  //     if (err) throw err
  //     console.log('Downloaded to ' + localFile)
  //     count--
  //     if (count <= 0) {
  //       conn.end()
  //     }
  //   })
  // })

  // download file using stream
  // const wtr = fs.createWriteStream(localFile, { autoClose: true })
  // const rdr = sftp.createReadStream(remoteFile, { autoClose: true })
  // rdr.once('error', (err) => {
  //   console.error('Error downloading file: ' + err)
  //   count--
  //   if (count <= 0) {
  //     conn.end()
  //   }
  // })
  // wtr.once('error', (err) => {
  //   console.error('Error writing file: ' + err)
  //   count--
  //   if (count <= 0) {
  //     conn.end()
  //   }
  // })
  // rdr.once('end', () => {
  //   console.log('Downloaded to ' + localFile)
  //   count--
  //   if (count <= 0) {
  //     conn.end()
  //   }
  // })
  // rdr.pipe(wtr)
}

const conn = new Client()
conn.on('ready', () => {
  console.log('SFTP Client :: ready')
  conn.sftp((err, sftp) => {
    if (err){
      core.setFailed(err.message)
      throw err
    }

    sftp.readdir(remoteDirPath, (errReadDir, allFiles) => {
      if (errReadDir){
        conn.end()
        core.setFailed(errReadDir.message)
        throw errReadDir
      }

      const listToDownload: FileToDownload[] = allFiles
        .filter(file => filePatternsToDownload.some(pattern => file.filename.match(pattern) !== null))
        .map(file => ({
          filename: file.filename,
          localPath: path.join('.', file.filename),
          remotePath: path.posix.join(remoteDirPath, file.filename),
        }))

      core.setOutput('filenames', listToDownload.map(file => file.filename).join(', '))

      if (listToDownload.length === 0) {
        console.log('No files to clear')
        console.log('Files in remote directory:', allFiles.map(file => file.filename).join(', '))

        conn.end()
        if (failIfNoFiles){
          core.setFailed('No files to clear')
        }
        return
      }

      console.log('Number of files to clear:', listToDownload.length)
      console.log('Files to clear:', listToDownload.map(file => file.filename).join(', '))
      console.log('Clearing files...')

      executeAction(conn, sftp, listToDownload, 0)
    })

  })
})
conn.on('error', err => {
  console.error(`Error caught, ${err}`)
  core.setFailed(err.message)
  throw err
})
conn.connect(credentials)
