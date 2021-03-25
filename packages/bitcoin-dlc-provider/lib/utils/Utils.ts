import randomBytes from 'randombytes';

export async function asyncForEach(array: any, callback: any) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

export function generateSerialId(): bigint {
  return randomBytes(4).reduce((acc, num, i) => acc + num ** i, 0);
}
