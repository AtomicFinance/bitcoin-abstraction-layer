declare module '@liquality/errors' {
  function DuplicateProviderError(error: string): any;
  function InvalidProviderError(error: string): any;
  function NoProviderError(error: string): any;
  function UnimplementedMethodError(error: string): any;
  function UnsupportedMethodError(error: string): any;
}
