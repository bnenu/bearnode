// Deps
const path = require('path')
const fs = require('fs')
const { Async, log, parseJsonToObj } = require('../helpers')

// type FileDescriptor = Int
// type Error = {} | String

// _open :: String -> String -> ((Error, FileDescriptor) -> ()) -> () | Async Error FileDescriptor
const _open = (path, flags, cb) => {
  if(cb) {
    return fs.open(path, flags, cb)
  }

  return Async((rej, res) => {
    fs.open(path, flags, (err, fd) => {
      if(err) return rej('Error opening or creating the file')
      return res(fd)
    })
  })
}

// _readFile :: String -> String -> ((Error, String) -> ()) -> () | Async Error String
const _readFile = (path, encoding, cb) => {
  if(cb) {
    return fs.readFile(path, encoding, cb)
  }

  return Async((rej, res) => {
    fs.readFile(path, encoding, (err, data) => {
      if(err) return rej('Error reading the file')
      res(data)
    })
  })
}

// _writeFile :: FileDescriptor -> String -> (Error -> ()) -> () | Async Error FileDescriptor
const _writeFile = (fd, data, cb) => {
  if(cb) {
    return fs.writeFile(fd, data, cb)
  }

  return Async((rej, res) => {
    fs.writeFile(fd, data, (err) => {
      if(err) return rej('Error writing file')
      return res(fd)
    })
  })
}

// _close :: FileDescriptor -> (Error -> ()) -> () | Async Error Boolean
const _close = (fd, cb) => {
  if(cb) {
    return fs.close(fd, cb)
  }

  return Async((rej, res) => {
    fs.close(fd, err => {
      if(err) return rej('Error closing file')
      return res(true)
    })
  })
}

// _ftruncate :: FileDescriptor -> (Error -> ()) -> () | Async Error FileDescriptor
const _ftruncate = (fd, cb) => {
  if(cb) {
    return fs.ftruncate(fd, cb)
  }

  return Async((rej, res) => {
    fs.ftruncate(fd, err => {
      if(err) return rej('Error could not truncate file')
      return res(fd)
    })
  })
}

// _unlink :: String -> (Error -> ()) -> () | Async Error Boolean
const _unlink = (path, cb) => {
  if(cb) {
    return fs.unlink(path, cb)
  }

  return Async((rej, res) => {
    fs.unlink(path, err => {
      if(err) rej('Error could not delete file')
      return res(true)
    })
  })
}

// Files handling
let lib = {}

lib.baseDir = path.join(__dirname, '/../.data/')

// create :: String -> String -> {} -> ((Error, a) -> ()) -> () | Async Error Boolean
lib.create = function(dir, file, data, cb) {
  if(cb) {
    return _open(`${lib.baseDir}${dir}/${file}.json`, 'wx', (err, fileDescriptor) => {
      if(!err && fileDescriptor) {
        const stringData = JSON.stringify(data)

        _writeFile(fileDescriptor, stringData, err => {
          if(!err) {
            _close(fileDescriptor, err => {
              if(!err) {
                cb(false)
              } else {
                cb('Error closing new file')
              }
            })
          } else {
            cb('Error writing new file')
          }
        })
      } else {
        log('create err: ', err)
        cb('Could not create new file, it may already exist!')
      }
    })
  }

  return _open(`${lib.baseDir}${dir}/${file}.json`, 'wx')
    .chain(fd => _writeFile(fd, JSON.stringify(data)))
    .chain(_close)
    .map(() => data)

}

// read :: String -> String -> ((Error, a) -> ()) -> () | Async Error a
lib.read = function(dir, file, cb) {
  if(cb) {
    return _readFile(
      `${lib.baseDir}${dir}/${file}.json`,
      'utf-8',
      (err, data) => err ? cb(err, data) : cb(false, parseJsonToObj(data))
    )
  }

  return _readFile(`${lib.baseDir}${dir}/${file}.json`, 'utf-8')
    .map(data => parseJsonToObj(data))
}

// update :: String -> String -> {} -> (Error -> ()) -> () | Async Error Boolean
lib.update = function(dir, file, data, cb) {
  if(cb) {
    return _open(`${lib.baseDir}${dir}/${file}.json`, 'r+', (err, fileDescriptor) => {
      if(err || !fileDescriptor) {
        return cb('Error opening the file')
      }

      const stringData = JSON.stringify(data)

      _ftruncate(fileDescriptor, 10, err => {
        if(err) {
          return cb('Error could not truncate existing file')
        }

        _writeFile(fileDescriptor, stringData, err => {
          if(err) {
            return cb('Error writing to the existing file!')
          }

          _close(fileDescriptor, err => {
            if(err) {
              return cb('Error closing the file')
            }

            return cb(false)
          })
        })
      })
    })
  }

  return _open(`${lib.baseDir}${dir}/${file}.json`, 'r+')
    .chain(fd => _ftruncate(fd, 10))
    .chain(fd => _writeFile(fd, JSON.stringify(data)))
    .chain(_close)
}

// delete :: String -> String -> (Error -> ()) -> () | Async Error Boolean
lib.delete = function(dir, file, cb) {
  if(cb) {
    return _unlink(`${lib.baseDir}${dir}/${file}.json`, err => {
      if(err) {
        return cb('Error deleting the file')
      }

      return cb(false)
    })
  }

  return _unlink(`${lib.baseDir}${dir}/${file}.json`)
}

module.exports = lib
