const { parentPort, workerData } = require('worker_threads')
const cfddlcjs = require('cfd-dlc-js')
const { cetSignRequest } = workerData
// console.log('cetSignRequest', cetSignRequest)
const result = cfddlcjs.CreateCetAdaptorSignatures(cetSignRequest)
parentPort.postMessage(result)
