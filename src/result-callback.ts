// TODO: We should not be using resul callbacks, instead we should use neverthrow results directly.

export type OkCallbackParameters<_TError = Error, TData = unknown> = [
	error: undefined,
	data: TData,
];

export type ErrorCallbackParameters<TError = Error, _TData = unknown> = [
	error: TError,
	data: undefined,
];

export type ResultCallbackParameters<TError = Error, TData = unknown> =
	| OkCallbackParameters<TError, TData>
	| ErrorCallbackParameters<TError, TData>;

export type OkCallback<TData = unknown> = (
	...args: OkCallbackParameters<undefined, TData>
) => void;

export type ErrorCallback<TError = Error> = (
	...args: ErrorCallbackParameters<TError, unknown>
) => void;

export type ResultCallback<TError = Error, TData = unknown> = (
	...args: ResultCallbackParameters<TError, TData>
) => void;
