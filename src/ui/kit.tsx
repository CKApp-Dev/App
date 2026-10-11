// Metro selects kit.ios.tsx or kit.android.tsx on devices.
// TypeScript resolves this entry to the Android implementation; both native
// implementations check their exports against the shared Kit contract.
export * from './kit.android';
export { default } from './kit.android';
