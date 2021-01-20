export function isNode() {
  var isNode = false;    
  if (typeof process === 'object') {
    if (typeof process.versions === 'object') {
      if (typeof process.versions.node !== 'undefined') {
        isNode = true;
      }
    }
  }

  return isNode
}
