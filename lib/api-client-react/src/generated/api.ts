onst {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetCallQueryKey(callId);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getCall>>> = ({ signal }) => getCall(callId, { signal, ...requestOptions });





   return  { queryKey, queryFn, enabled: callId !== null && callId !== undefined, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getCall>>, TError, TData> & { queryKey: QueryKey }
}

export type GetCallQueryResult = NonNullable<Awaited<ReturnType<typeof getCall>>>
export type GetCallQueryError = ErrorType<ErrorResponse>


/**
 * @summary Get a call available to the authenticated participant
 */

export function useGetCall<TData = Awaited<ReturnType<typeof getCall>>, TError = ErrorType<ErrorResponse>>(
 callId: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getCall>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetCallQueryOptions(callId,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getAcceptCallUrl = (callId: number,) => {




  return `/api/calls/${callId}/accept`
}

/**
 * @summary Accept an incoming call
 */
export const acceptCall = async (callId: number, options?: Parameters<typeof customFetch>[1]): Promise<Call> => {

  return customFetch<Call>(getAcceptCallUrl(callId),
  {
    ...options,
    method: 'POST'


  }
);}





export const getAcceptCallMutationKey = () => ['acceptCall'] as const;

export const getAcceptCallMutationOptions = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof acceptCall>>, TError,AcceptCallMutationVariables, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof acceptCall>>, TError,AcceptCallMutationVariables, TContext> => {

const mutationKey = getAcceptCallMutationKey();
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof acceptCall>>, AcceptCallMutationVariables> = (props) => {
          const {callId} = props ?? {};

          return  acceptCall(callId,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type AcceptCallMutationResult = NonNullable<Awaited<ReturnType<typeof acceptCall>>>

    export type AcceptCallMutationError = ErrorType<unknown>
    export type AcceptCallMutationVariables = {callId: number}

    /**
 * @summary Accept an incoming call
 */
export const useAcceptCall = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof acceptCall>>, TError,AcceptCallMutationVariables, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof acceptCall>>,
        TError,
        AcceptCallMutationVariables,
        TContext
      > => {
      return useMutation(getAcceptCallMutationOptions(options));
    }

export const getDeclineCallUrl = (callId: number,) => {




  return `/api/calls/${callId}/decline`
}

/**
 * @summary Decline an incoming call
 */
export const declineCall = async (callId: number, options?: Parameters<typeof customFetch>[1]): Promise<Call> => {

  return customFetch<Call>(getDeclineCallUrl(callId),
  {
    ...options,
    method: 'POST'


  }
);}





export const getDeclineCallMutationKey = () => ['declineCall'] as const;

export const getDeclineCallMutationOptions = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof declineCall>>, TError,DeclineCallMutationVariables, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof declineCall>>, TError,DeclineCallMutationVariables, TContext> => {

const mutationKey = getDeclineCallMutationKey();
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof declineCall>>, DeclineCallMutationVariables> = (props) => {
          const {callId} = props ?? {};

          return  declineCall(callId,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type DeclineCallMutationResult = NonNullable<Awaited<ReturnType<typeof declineCall>>>

    export type DeclineCallMutationError = ErrorType<unknown>
    export type DeclineCallMutationVariables = {callId: number}

    /**
 * @summary Decline an incoming call
 */
export const useDeclineCall = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof declineCall>>, TError,DeclineCallMutationVariables, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof declineCall>>,
        TError,
        DeclineCallMutationVariables,
        TContext
      > => {
      return useMutation(getDeclineCallMutationOptions(options));
    }

export const getEndCallUrl = (callId: number,) => {




  return `/api/calls/${callId}/end`
}

/**
 * @summary End an active call
 */
export const endCall = async (callId: number, options?: Parameters<typeof customFetch>[1]): Promise<Call> => {

  return customFetch<Call>(getEndCallUrl(callId),
  {
    ...options,
    method: 'POST'


  }
);}





export const getEndCallMutationKey = () => ['endCall'] as const;

export const getEndCallMutationOptions = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof endCall>>, TError,EndCallMutationVariables, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof endCall>>, TError,EndCallMutationVariables, TContext> => {

const mutationKey = getEndCallMutationKey();
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof endCall>>, EndCallMutationVariables> = (props) => {
          const {callId} = props ?? {};

          return  endCall(callId,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type EndCallMutationResult = NonNullable<Awaited<ReturnType<typeof endCall>>>

    export type EndCallMutationError = ErrorType<unknown>
    export type EndCallMutationVariables = {callId: number}

    /**
 * @summary End an active call
 */
export const useEndCall = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof endCall>>, TError,EndCallMutationVariables, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof endCall>>,
        TError,
        EndCallMutationVariables,
        TContext
      > => {
      return useMutation(getEndCallMutationOptions(options));
    }

export const getGetCallLiveKitTokenUrl = (callId: number,) => {




  return `/api/calls/${callId}/token`
}

/**
 * @summary Get a short-lived audio token for an accepted call
 */
export const getCallLiveKitToken = async (callId: number, options?: Parameters<typeof customFetch>[1]): Promise<LiveKitToken> => {

  return customFetch<LiveKitToken>(getGetCallLiveKitTokenUrl(callId),
  {
    ...options,
    method: 'POST'


  }
);}





export const getGetCallLiveKitTokenMutationKey = () => ['getCallLiveKitToken'] as const;

export const getGetCallLiveKitTokenMutationOptions = <TError = ErrorType<ErrorResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof getCallLiveKitToken>>, TError,GetCallLiveKitTokenMutationVariables, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof getCallLiveKitToken>>, TError,GetCallLiveKitTokenMutationVariables, TContext> => {

const mutationKey = getGetCallLiveKitTokenMutationKey();
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof getCallLiveKitToken>>, GetCallLiveKitTokenMutationVariables> = (props) => {
          const {callId} = props ?? {};

          return  getCallLiveKitToken(callId,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type GetCallLiveKitTokenMutationResult = NonNullable<Awaited<ReturnType<typeof getCallLiveKitToken>>>

    export type GetCallLiveKitTokenMutationError = ErrorType<ErrorResponse>
    export type GetCallLiveKitTokenMutationVariables = {callId: number}

    /**
 * @summary Get a short-lived audio token for an accepted call
 */
export const useGetCallLiveKitToken = <TError = ErrorType<ErrorResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof getCallLiveKitToken>>, TError,GetCallLiveKitTokenMutationVariables, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof getCallLiveKitToken>>,
        TError,
        GetCallLiveKitTokenMutationVariables,
        TContext
      > => {
      return useMutation(getGetCallLiveKitTokenMutationOptions(options));
    }

export const getGetCurrentEventRoomsUrl = (params?: GetCurrentEventRoomsParams,) => {
  const normalizedParams = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {

    if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : String(value))
    }
  });

  const stringifiedParams = normalizedParams.toString();

  return stringifiedParams.length > 0 ? `/api/current-events/rooms?${stringifiedParams}` : `/api/current-events/rooms`
}

/**
 * @summary List live Current Events rooms
 */
export const getCurrentEventRooms = async (params?: GetCurrentEventRoomsParams, options?: Parameters<typeof customFetch>[1]): Promise<CurrentEventRoomList> => {

  return customFetch<CurrentEventRoomList>(getGetCurrentEventRoomsUrl(params),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetCurrentEventRoomsQueryKey = (params?: GetCurrentEventRoomsParams,) => {
    return [
    `/api/current-events/rooms`, ...(params ? [params] : [])
    ] as const;
    }


export const getGetCurrentEventRoomsQueryOptions = <TData = Awaited<ReturnType<typeof getCurrentEventRooms>>, TError = ErrorType<unknown>>(params?: GetCurrentEventRoomsParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getCurrentEventRooms>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetCurrentEventRoomsQueryKey(params);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getCurrentEventRooms>>> = ({ signal }) => getCurrentEventRooms(params, { signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getCurrentEventRooms>>, TError, TData> & { queryKey: QueryKey }
}

export type GetCurrentEventRoomsQueryResult = NonNullable<Awaited<ReturnType<typeof getCurrentEventRooms>>>
export type GetCurrentEventRoomsQueryError = ErrorType<unknown>


/**
 * @summary List live Current Events rooms
 */

export function useGetCurrentEventRooms<TData = Awaited<ReturnType<typeof getCurrentEventRooms>>, TError = ErrorType<unknown>>(
 params?: GetCurrentEventRoomsParams, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getCurrentEventRooms>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetCurrentEventRoomsQueryOptions(params,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getCreateCurrentEventRoomUrl = () => {




  return `/api/current-events/rooms`
}

/**
 * @summary Start a live Current Events room
 */
export const createCurrentEventRoom = async (currentEventRoomInput: CurrentEventRoomInput, options?: Parameters<typeof customFetch>[1]): Promise<CurrentEventRoom> => {

    const getHeaders = (h?: NonNullable<RequestInit['headers']>): Record<string, string | readonly string[]> => {
    if (!h) return {};
    if (h instanceof Headers) return Object.fromEntries(h.entries());
    if (Array.isArray(h)) return Object.fromEntries(h);
    return h;
  };
return customFetch<CurrentEventRoom>(getCreateCurrentEventRoomUrl(),
  {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getHeaders(options?.headers) },
    body: JSON.stringify(currentEventRoomInput)
  }
);}





export const getCreateCurrentEventRoomMutationKey = () => ['createCurrentEventRoom'] as const;

export const getCreateCurrentEventRoomMutationOptions = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createCurrentEventRoom>>, TError,CreateCurrentEventRoomMutationVariables, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof createCurrentEventRoom>>, TError,CreateCurrentEventRoomMutationVariables, TContext> => {

const mutationKey = getCreateCurrentEventRoomMutationKey();
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof createCurrentEventRoom>>, CreateCurrentEventRoomMutationVariables> = (props) => {
          const {data} = props ?? {};

          return  createCurrentEventRoom(data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type CreateCurrentEventRoomMutationResult = NonNullable<Awaited<ReturnType<typeof createCurrentEventRoom>>>
    export type CreateCurrentEventRoomMutationBody = BodyType<CurrentEventRoomInput>
    export type CreateCurrentEventRoomMutationError = ErrorType<unknown>
    export type CreateCurrentEventRoomMutationVariables = {data: BodyType<CurrentEventRoomInput>}

    /**
 * @summary Start a live Current Events room
 */
export const useCreateCurrentEventRoom = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createCurrentEventRoom>>, TError,CreateCurrentEventRoomMutationVariables, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof createCurrentEventRoom>>,
        TError,
        CreateCurrentEventRoomMutationVariables,
        TContext
      > => {
      return useMutation(getCreateCurrentEventRoomMutationOptions(options));
    }

export const getGetCurrentEventRoomUrl = (roomId: number,) => {




  return `/api/current-events/rooms/${roomId}`
}

/**
 * @summary Get a live Current Events room
 */
export const getCurrentEventRoom = async (roomId: number, options?: Parameters<typeof customFetch>[1]): Promise<CurrentEventRoom> => {

  return customFetch<CurrentEventRoom>(getGetCurrentEventRoomUrl(roomId),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetCurrentEventRoomQueryKey = (roomId: number,) => {
    return [
    `/api/current-events/rooms/${roomId}`
    ] as const;
    }


export const getGetCurrentEventRoomQueryOptions = <TData = Awaited<ReturnType<typeof getCurrentEventRoom>>, TError = ErrorType<unknown>>(roomId: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getCurrentEventRoom>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetCurrentEventRoomQueryKey(roomId);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getCurrentEventRoom>>> = ({ signal }) => getCurrentEventRoom(roomId, { signal, ...requestOptions });





   return  { queryKey, queryFn, enabled: roomId !== null && roomId !== undefined, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getCurrentEventRoom>>, TError, TData> & { queryKey: QueryKey }
}

export type GetCurrentEventRoomQueryResult = NonNullable<Awaited<ReturnType<typeof getCurrentEventRoom>>>
export type GetCurrentEventRoomQueryError = ErrorType<unknown>


/**
 * @summary Get a live Current Events room
 */

export function useGetCurrentEventRoom<TData = Awaited<ReturnType<typeof getCurrentEventRoom>>, TError = ErrorType<unknown>>(
 roomId: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getCurrentEventRoom>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetCurrentEventRoomQueryOptions(roomId,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getJoinCurrentEventRoomUrl = (roomId: number,) => {




  return `/api/current-events/rooms/${roomId}/join`
}

/**
 * @summary Join a room as a listener
 */
export const joinCurrentEventRoom = async (roomId: number, options?: Parameters<typeof customFetch>[1]): Promise<CurrentEventRoom> => {

  return customFetch<CurrentEventRoom>(getJoinCurrentEventRoomUrl(roomId),
  {
    ...options,
    method: 'POST'


  }
);}





export const getJoinCurrentEventRoomMutationKey = () => ['joinCurrentEventRoom'] as const;

export const getJoinCurrentEventRoomMutationOptions = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof joinCurrentEventRoom>>, TError,JoinCurrentEventRoomMutationVariables, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof joinCurrentEventRoom>>, TError,JoinCurrentEventRoomMutationVariables, TContext> => {

const mutationKey = getJoinCurrentEventRoomMutationKey();
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof joinCurrentEventRoom>>, JoinCurrentEventRoomMutationVariables> = (props) => {
          const {roomId} = props ?? {};

          return  joinCurrentEventRoom(roomId,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type JoinCurrentEventRoomMutationResult = NonNullable<Awaited<ReturnType<typeof joinCurrentEventRoom>>>

    export type JoinCurrentEventRoomMutationError = ErrorType<unknown>
    export type JoinCurrentEventRoomMutationVariables = {roomId: number}

    /**
 * @summary Join a room as a listener
 */
export const useJoinCurrentEventRoom = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof joinCurrentEventRoom>>, TError,JoinCurrentEventRoomMutationVariables, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof joinCurrentEventRoom>>,
        TError,
        JoinCurrentEventRoomMutationVariables,
        TContext
      > => {
      return useMutation(getJoinCurrentEventRoomMutationOptions(options));
    }

export const getGetCurrentEventLiveKitTokenUrl = (roomId: number,) => {




  return `/api/current-events/rooms/${roomId}/token`
}

/**
 * @summary Get a short-lived audio token for a joined Current Events room
 */
export const getCurrentEventLiveKitToken = async (roomId: number, options?: Parameters<typeof customFetch>[1]): Promise<CurrentEventLiveKitToken> => {

  return customFetch<CurrentEventLiveKitToken>(getGetCurrentEventLiveKitTokenUrl(roomId),
  {
    ...options,
    method: 'POST'


  }
);}





export const getGetCurrentEventLiveKitTokenMutationKey = () => ['getCurrentEventLiveKitToken'] as const;

export const getGetCurrentEventLiveKitTokenMutationOptions = <TError = ErrorType<ErrorResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof getCurrentEventLiveKitToken>>, TError,GetCurrentEventLiveKitTokenMutationVariables, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof getCurrentEventLiveKitToken>>, TError,GetCurrentEventLiveKitTokenMutationVariables, TContext> => {

const mutationKey = getGetCurrentEventLiveKitTokenMutationKey();
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof getCurrentEventLiveKitToken>>, GetCurrentEventLiveKitTokenMutationVariables> = (props) => {
          const {roomId} = props ?? {};

          return  getCurrentEventLiveKitToken(roomId,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type GetCurrentEventLiveKitTokenMutationResult = NonNullable<Awaited<ReturnType<typeof getCurrentEventLiveKitToken>>>

    export type GetCurrentEventLiveKitTokenMutationError = ErrorType<ErrorResponse>
    export type GetCurrentEventLiveKitTokenMutationVariables = {roomId: number}

    /**
 * @summary Get a short-lived audio token for a joined Current Events room
 */
export const useGetCurrentEventLiveKitToken = <TError = ErrorType<ErrorResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof getCurrentEventLiveKitToken>>, TError,GetCurrentEventLiveKitTokenMutationVariables, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof getCurrentEventLiveKitToken>>,
        TError,
        GetCurrentEventLiveKitTokenMutationVariables,
        TContext
      > => {
      return useMutation(getGetCurrentEventLiveKitTokenMutationOptions(options));
    }

export const getLeaveCurrentEventRoomUrl = (roomId: number,) => {




  return `/api/current-events/rooms/${roomId}/leave`
}

/**
 * @summary Leave a live room
 */
export const leaveCurrentEventRoom = async (roomId: number, options?: Parameters<typeof customFetch>[1]): Promise<ActionResult> => {

  return customFetch<ActionResult>(getLeaveCurrentEventRoomUrl(roomId),
  {
    ...options,
    method: 'POST'


  }
);}





export const getLeaveCurrentEventRoomMutationKey = () => ['leaveCurrentEventRoom'] as const;

export const getLeaveCurrentEventRoomMutationOptions = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof leaveCurrentEventRoom>>, TError,LeaveCurrentEventRoomMutationVariables, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof leaveCurrentEventRoom>>, TError,LeaveCurrentEventRoomMutationVariables, TContext> => {

const mutationKey = getLeaveCurrentEventRoomMutationKey();
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof leaveCurrentEventRoom>>, LeaveCurrentEventRoomMutationVariables> = (props) => {
          const {roomId} = props ?? {};

          return  leaveCurrentEventRoom(roomId,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type LeaveCurrentEventRoomMutationResult = NonNullable<Awaited<ReturnType<typeof leaveCurrentEventRoom>>>

    export type LeaveCurrentEventRoomMutationError = ErrorType<unknown>
    export type LeaveCurrentEventRoomMutationVariables = {roomId: number}

    /**
 * @summary Leave a live room
 */
export const useLeaveCurrentEventRoom = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof leaveCurrentEventRoom>>, TError,LeaveCurrentEventRoomMutationVariables, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof leaveCurrentEventRoom>>,
        TError,
        LeaveCurrentEventRoomMutationVariables,
        TContext
      > => {
      return useMutation(getLeaveCurrentEventRoomMutationOptions(options));
    }

export const getSetCurrentEventHandUrl = (roomId: number,) => {




  return `/api/current-events/rooms/${roomId}/hand`
}

/**
 * @summary Raise or lower the caller's hand
 */
export const setCurrentEventHand = async (roomId: number,
    currentEventHandInput: CurrentEventHandInput, options?: Parameters<typeof customFetch>[1]): Promise<CurrentEventRoom> => {

    const getHeaders = (h?: NonNullable<RequestInit['headers']>): Record<string, string | readonly string[]> => {
    if (!h) return {};
    if (h instanceof Headers) return Object.fromEntries(h.entries());
    if (Array.isArray(h)) return Object.fromEntries(h);
    return h;
  };
return customFetch<CurrentEventRoom>(getSetCurrentEventHandUrl(roomId),
  {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getHeaders(options?.headers) },
    body: JSON.stringify(currentEventHandInput)
  }
);}





export const getSetCurrentEventHandMutationKey = () => ['setCurrentEventHand'] as const;

export const getSetCurrentEventHandMutationOptions = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof setCurrentEventHand>>, TError,SetCurrentEventHandMutationVariables, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof setCurrentEventHand>>, TError,SetCurrentEventHandMutationVariables, TContext> => {

const mutationKey = getSetCurrentEventHandMutationKey();
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof setCurrentEventHand>>, SetCurrentEventHandMutationVariables> = (props) => {
          const {roomId,data} = props ?? {};

          return  setCurrentEventHand(roomId,data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type SetCurrentEventHandMutationResult = NonNullable<Awaited<ReturnType<typeof setCurrentEventHand>>>
    export type SetCurrentEventHandMutationBody = BodyType<CurrentEventHandInput>
    export type SetCurrentEventHandMutationError = ErrorType<unknown>
    export type SetCurrentEventHandMutationVariables = {roomId: number;data: BodyType<CurrentEventHandInput>}

    /**
 * @summary Raise or lower the caller's hand
 */
export const useSetCurrentEventHand = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof setCurrentEventHand>>, TError,SetCurrentEventHandMutationVariables, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof setCurrentEventHand>>,
        TError,
        SetCurrentEventHandMutationVariables,
        TContext
      > => {
      return useMutation(getSetCurrentEventHandMutationOptions(options));
    }

export const getUpdateCurrentEventParticipantUrl = (roomId: number,
    participantId: number,) => {




  return `/api/current-events/rooms/${roomId}/participants/${participantId}`
}

/**
 * @summary Promote, demote, mute, or remove a participant
 */
export const updateCurrentEventParticipant = async (roomId: number,
    participantId: number,
    currentEventParticipantAction: CurrentEventParticipantAction, options?: Parameters<typeof customFetch>[1]): Promise<CurrentEventRoom> => {

    const getHeaders = (h?: NonNullable<RequestInit['headers']>): Record<string, string | readonly string[]> => {
    if (!h) return {};
    if (h instanceof Headers) return Object.fromEntries(h.entries());
    if (Array.isArray(h)) return Object.fromEntries(h);
    return h;
  };
return customFetch<CurrentEventRoom>(getUpdateCurrentEventParticipantUrl(roomId,participantId),
  {
    ...options,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getHeaders(options?.headers) },
    body: JSON.stringify(currentEventParticipantAction)
  }
);}





export const getUpdateCurrentEventParticipantMutationKey = () => ['updateCurrentEventParticipant'] as const;

export const getUpdateCurrentEventParticipantMutationOptions = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateCurrentEventParticipant>>, TError,UpdateCurrentEventParticipantMutationVariables, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof updateCurrentEventParticipant>>, TError,UpdateCurrentEventParticipantMutationVariables, TContext> => {

const mutationKey = getUpdateCurrentEventParticipantMutationKey();
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof updateCurrentEventParticipant>>, UpdateCurrentEventParticipantMutationVariables> = (props) => {
          const {roomId,participantId,data} = props ?? {};

          return  updateCurrentEventParticipant(roomId,participantId,data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type UpdateCurrentEventParticipantMutationResult = NonNullable<Awaited<ReturnType<typeof updateCurrentEventParticipant>>>
    export type UpdateCurrentEventParticipantMutationBody = BodyType<CurrentEventParticipantAction>
    export type UpdateCurrentEventParticipantMutationError = ErrorType<unknown>
    export type UpdateCurrentEventParticipantMutationVariables = {roomId: number;participantId: number;data: BodyType<CurrentEventParticipantAction>}

    /**
 * @summary Promote, demote, mute, or remove a participant
 */
export const useUpdateCurrentEventParticipant = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof updateCurrentEventParticipant>>, TError,UpdateCurrentEventParticipantMutationVariables, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof updateCurrentEventParticipant>>,
        TError,
        UpdateCurrentEventParticipantMutationVariables,
        TContext
      > => {
      return useMutation(getUpdateCurrentEventParticipantMutationOptions(options));
    }

export const getGetCurrentEventMessagesUrl = (roomId: number,) => {




  return `/api/current-events/rooms/${roomId}/messages`
}

/**
 * @summary List text messages for a room
 */
export const getCurrentEventMessages = async (roomId: number, options?: Parameters<typeof customFetch>[1]): Promise<CurrentEventMessageList> => {

  return customFetch<CurrentEventMessageList>(getGetCurrentEventMessagesUrl(roomId),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetCurrentEventMessagesQueryKey = (roomId: number,) => {
    return [
    `/api/current-events/rooms/${roomId}/messages`
    ] as const;
    }


export const getGetCurrentEventMessagesQueryOptions = <TData = Awaited<ReturnType<typeof getCurrentEventMessages>>, TError = ErrorType<unknown>>(roomId: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getCurrentEventMessages>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetCurrentEventMessagesQueryKey(roomId);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getCurrentEventMessages>>> = ({ signal }) => getCurrentEventMessages(roomId, { signal, ...requestOptions });





   return  { queryKey, queryFn, enabled: roomId !== null && roomId !== undefined, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getCurrentEventMessages>>, TError, TData> & { queryKey: QueryKey }
}

export type GetCurrentEventMessagesQueryResult = NonNullable<Awaited<ReturnType<typeof getCurrentEventMessages>>>
export type GetCurrentEventMessagesQueryError = ErrorType<unknown>


/**
 * @summary List text messages for a room
 */

export function useGetCurrentEventMessages<TData = Awaited<ReturnType<typeof getCurrentEventMessages>>, TError = ErrorType<unknown>>(
 roomId: number, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getCurrentEventMessages>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetCurrentEventMessagesQueryOptions(roomId,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getCreateCurrentEventMessageUrl = (roomId: number,) => {




  return `/api/current-events/rooms/${roomId}/messages`
}

/**
 * @summary Send a text message in a room
 */
export const createCurrentEventMessage = async (roomId: number,
    currentEventMessageInput: CurrentEventMessageInput, options?: Parameters<typeof customFetch>[1]): Promise<CurrentEventMessage> => {

    const getHeaders = (h?: NonNullable<RequestInit['headers']>): Record<string, string | readonly string[]> => {
    if (!h) return {};
    if (h instanceof Headers) return Object.fromEntries(h.entries());
    if (Array.isArray(h)) return Object.fromEntries(h);
    return h;
  };
return customFetch<CurrentEventMessage>(getCreateCurrentEventMessageUrl(roomId),
  {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getHeaders(options?.headers) },
    body: JSON.stringify(currentEventMessageInput)
  }
);}





export const getCreateCurrentEventMessageMutationKey = () => ['createCurrentEventMessage'] as const;

export const getCreateCurrentEventMessageMutationOptions = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createCurrentEventMessage>>, TError,CreateCurrentEventMessageMutationVariables, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof createCurrentEventMessage>>, TError,CreateCurrentEventMessageMutationVariables, TContext> => {

const mutationKey = getCreateCurrentEventMessageMutationKey();
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof createCurrentEventMessage>>, CreateCurrentEventMessageMutationVariables> = (props) => {
          const {roomId,data} = props ?? {};

          return  createCurrentEventMessage(roomId,data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type CreateCurrentEventMessageMutationResult = NonNullable<Awaited<ReturnType<typeof createCurrentEventMessage>>>
    export type CreateCurrentEventMessageMutationBody = BodyType<CurrentEventMessageInput>
    export type CreateCurrentEventMessageMutationError = ErrorType<unknown>
    export type CreateCurrentEventMessageMutationVariables = {roomId: number;data: BodyType<CurrentEventMessageInput>}

    /**
 * @summary Send a text message in a room
 */
export const useCreateCurrentEventMessage = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createCurrentEventMessage>>, TError,CreateCurrentEventMessageMutationVariables, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof createCurrentEventMessage>>,
        TError,
        CreateCurrentEventMessageMutationVariables,
        TContext
      > => {
      return useMutation(getCreateCurrentEventMessageMutationOptions(options));
    }

export const getSendCurrentEventGiftUrl = (roomId: number,) => {




  return `/api/current-events/rooms/${roomId}/gifts`
}

/**
 * @summary Send a coin gift to a room speaker
 */
export const sendCurrentEventGift = async (roomId: number,
    currentEventGiftInput: CurrentEventGiftInput, options?: Parameters<typeof customFetch>[1]): Promise<CurrentEventGiftResult> => {

    const getHeaders = (h?: NonNullable<RequestInit['headers']>): Record<string, string | readonly string[]> => {
    if (!h) return {};
    if (h instanceof Headers) return Object.fromEntries(h.entries());
    if (Array.isArray(h)) return Object.fromEntries(h);
    return h;
  };
return customFetch<CurrentEventGiftResult>(getSendCurrentEventGiftUrl(roomId),
  {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getHeaders(options?.headers) },
    body: JSON.stringify(currentEventGiftInput)
  }
);}





export const getSendCurrentEventGiftMutationKey = () => ['sendCurrentEventGift'] as const;

export const getSendCurrentEventGiftMutationOptions = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof sendCurrentEventGift>>, TError,SendCurrentEventGiftMutationVariables, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof sendCurrentEventGift>>, TError,SendCurrentEventGiftMutationVariables, TContext> => {

const mutationKey = getSendCurrentEventGiftMutationKey();
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof sendCurrentEventGift>>, SendCurrentEventGiftMutationVariables> = (props) => {
          const {roomId,data} = props ?? {};

          return  sendCurrentEventGift(roomId,data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type SendCurrentEventGiftMutationResult = NonNullable<Awaited<ReturnType<typeof sendCurrentEventGift>>>
    export type SendCurrentEventGiftMutationBody = BodyType<CurrentEventGiftInput>
    export type SendCurrentEventGiftMutationError = ErrorType<unknown>
    export type SendCurrentEventGiftMutationVariables = {roomId: number;data: BodyType<CurrentEventGiftInput>}

    /**
 * @summary Send a coin gift to a room speaker
 */
export const useSendCurrentEventGift = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof sendCurrentEventGift>>, TError,SendCurrentEventGiftMutationVariables, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof sendCurrentEventGift>>,
        TError,
        SendCurrentEventGiftMutationVariables,
        TContext
      > => {
      return useMutation(getSendCurrentEventGiftMutationOptions(options));
    }

export const getGetCurrentEventWalletUrl = () => {




  return `/api/current-events/wallet`
}

/**
 * @summary Get the caller's Current Events coins and Gold
 */
export const getCurrentEventWallet = async ( options?: Parameters<typeof customFetch>[1]): Promise<CurrentEventWallet> => {

  return customFetch<CurrentEventWallet>(getGetCurrentEventWalletUrl(),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetCurrentEventWalletQueryKey = () => {
    return [
    `/api/current-events/wallet`
    ] as const;
    }


export const getGetCurrentEventWalletQueryOptions = <TData = Awaited<ReturnType<typeof getCurrentEventWallet>>, TError = ErrorType<unknown>>( options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getCurrentEventWallet>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetCurrentEventWalletQueryKey();



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getCurrentEventWallet>>> = ({ signal }) => getCurrentEventWallet({ signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getCurrentEventWallet>>, TError, TData> & { queryKey: QueryKey }
}

export type GetCurrentEventWalletQueryResult = NonNullable<Awaited<ReturnType<typeof getCurrentEventWallet>>>
export type GetCurrentEventWalletQueryError = ErrorType<unknown>


/**
 * @summary Get the caller's Current Events coins and Gold
 */

export function useGetCurrentEventWallet<TData = Awaited<ReturnType<typeof getCurrentEventWallet>>, TError = ErrorType<unknown>>(
  options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getCurrentEventWallet>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetCurrentEventWalletQueryOptions(options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getSyncCurrentEventWalletPurchasesUrl = () => {




  return `/api/current-events/wallet/sync-purchases`
}

/**
 * @summary Verify RevenueCat purchases and credit new coin packs
 */
export const syncCurrentEventWalletPurchases = async ( options?: Parameters<typeof customFetch>[1]): Promise<CurrentEventWalletSyncResult> => {

  return customFetch<CurrentEventWalletSyncResult>(getSyncCurrentEventWalletPurchasesUrl(),
  {
    ...options,
    method: 'POST'


  }
);}





export const getSyncCurrentEventWalletPurchasesMutationKey = () => ['syncCurrentEventWalletPurchases'] as const;

export const getSyncCurrentEventWalletPurchasesMutationOptions = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof syncCurrentEventWalletPurchases>>, TError,void, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof syncCurrentEventWalletPurchases>>, TError,void, TContext> => {

const mutationKey = getSyncCurrentEventWalletPurchasesMutationKey();
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof syncCurrentEventWalletPurchases>>, void> = () => {


          return  syncCurrentEventWalletPurchases(requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type SyncCurrentEventWalletPurchasesMutationResult = NonNullable<Awaited<ReturnType<typeof syncCurrentEventWalletPurchases>>>

    export type SyncCurrentEventWalletPurchasesMutationError = ErrorType<unknown>


    /**
 * @summary Verify RevenueCat purchases and credit new coin packs
 */
export const useSyncCurrentEventWalletPurchases = <TError = ErrorType<unknown>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof syncCurrentEventWalletPurchases>>, TError,void, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof syncCurrentEventWalletPurchases>>,
        TError,
        void,
        TContext
      > => {
      return useMutation(getSyncCurrentEventWalletPurchasesMutationOptions(options));
    }

export const getGetCreatorPayoutSettingsUrl = () => {




  return `/api/current-events/payouts/settings`
}

/**
 * @summary Get the caller's creator payout setup status
 */
export const getCreatorPayoutSettings = async ( options?: Parameters<typeof customFetch>[1]): Promise<CreatorPayoutSettings> => {

  return customFetch<CreatorPayoutSettings>(getGetCreatorPayoutSettingsUrl(),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetCreatorPayoutSettingsQueryKey = () => {
    return [
    `/api/current-events/payouts/settings`
    ] as const;
    }


export const getGetCreatorPayoutSettingsQueryOptions = <TData = Awaited<ReturnType<typeof getCreatorPayoutSettings>>, TError = ErrorType<unknown>>( options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getCreatorPayoutSettings>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetCreatorPayoutSettingsQueryKey();



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getCreatorPayoutSettings>>> = ({ signal }) => getCreatorPayoutSettings({ signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getCreatorPayoutSettings>>, TError, TData> & { queryKey: QueryKey }
}

export type GetCreatorPayoutSettingsQueryResult = NonNullable<Awaited<ReturnType<typeof getCreatorPayoutSettings>>>
export type GetCreatorPayoutSettingsQueryError = ErrorType<unknown>


/**
 * @summary Get the caller's creator payout setup status
 */

export function useGetCreatorPayoutSettings<TData = Awaited<ReturnType<typeof getCreatorPayoutSettings>>, TError = ErrorType<unknown>>(
  options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getCreatorPayoutSettings>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetCreatorPayoutSettingsQueryOptions(options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getCreateCreatorPayoutOnboardingLinkUrl = () => {




  return `/api/current-events/payouts/onboarding`
}

/**
 * @summary Create or refresh a Stripe Express onboarding link
 */
export const createCreatorPayoutOnboardingLink = async ( options?: Parameters<typeof customFetch>[1]): Promise<CreatorPayoutSettingsLink> => {

  return customFetch<CreatorPayoutSettingsLink>(getCreateCreatorPayoutOnboardingLinkUrl(),
  {
    ...options,
    method: 'POST'


  }
);}





export const getCreateCreatorPayoutOnboardingLinkMutationKey = () => ['createCreatorPayoutOnboardingLink'] as const;

export const getCreateCreatorPayoutOnboardingLinkMutationOptions = <TError = ErrorType<ErrorResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createCreatorPayoutOnboardingLink>>, TError,void, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof createCreatorPayoutOnboardingLink>>, TError,void, TContext> => {

const mutationKey = getCreateCreatorPayoutOnboardingLinkMutationKey();
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof createCreatorPayoutOnboardingLink>>, void> = () => {


          return  createCreatorPayoutOnboardingLink(requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type CreateCreatorPayoutOnboardingLinkMutationResult = NonNullable<Awaited<ReturnType<typeof createCreatorPayoutOnboardingLink>>>

    export type CreateCreatorPayoutOnboardingLinkMutationError = ErrorType<ErrorResponse>


    /**
 * @summary Create or refresh a Stripe Express onboarding link
 */
export const useCreateCreatorPayoutOnboardingLink = <TError = ErrorType<ErrorResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof createCreatorPayoutOnboardingLink>>, TError,void, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof createCreatorPayoutOnboardingLink>>,
        TError,
        void,
        TContext
      > => {
      return useMutation(getCreateCreatorPayoutOnboardingLinkMutationOptions(options));
    }

export const getGetCreatorWithdrawalHistoryUrl = () => {




  return `/api/current-events/payouts/withdrawals`
}

/**
 * @summary List the caller's creator withdrawals
 */
export const getCreatorWithdrawalHistory = async ( options?: Parameters<typeof customFetch>[1]): Promise<CreatorWithdrawalList> => {

  return customFetch<CreatorWithdrawalList>(getGetCreatorWithdrawalHistoryUrl(),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetCreatorWithdrawalHistoryQueryKey = () => {
    return [
    `/api/current-events/payouts/withdrawals`
    ] as const;
    }


export const getGetCreatorWithdrawalHistoryQueryOptions = <TData = Awaited<ReturnType<typeof getCreatorWithdrawalHistory>>, TError = ErrorType<unknown>>( options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getCreatorWithdrawalHistory>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetCreatorWithdrawalHistoryQueryKey();



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getCreatorWithdrawalHistory>>> = ({ signal }) => getCreatorWithdrawalHistory({ signal, ...requestOptions });





   return  { queryKey, queryFn, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getCreatorWithdrawalHistory>>, TError, TData> & { queryKey: QueryKey }
}

export type GetCreatorWithdrawalHistoryQueryResult = NonNullable<Awaited<ReturnType<typeof getCreatorWithdrawalHistory>>>
export type GetCreatorWithdrawalHistoryQueryError = ErrorType<unknown>


/**
 * @summary List the caller's creator withdrawals
 */

export function useGetCreatorWithdrawalHistory<TData = Awaited<ReturnType<typeof getCreatorWithdrawalHistory>>, TError = ErrorType<unknown>>(
  options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getCreatorWithdrawalHistory>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetCreatorWithdrawalHistoryQueryOptions(options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







export const getRequestCreatorWithdrawalUrl = () => {




  return `/api/current-events/payouts/withdrawals`
}

/**
 * @summary Request a USD creator withdrawal from gift-earned Gold
 */
export const requestCreatorWithdrawal = async (creatorWithdrawalRequest: CreatorWithdrawalRequest, options?: Parameters<typeof customFetch>[1]): Promise<CreatorWithdrawal> => {

    const getHeaders = (h?: NonNullable<RequestInit['headers']>): Record<string, string | readonly string[]> => {
    if (!h) return {};
    if (h instanceof Headers) return Object.fromEntries(h.entries());
    if (Array.isArray(h)) return Object.fromEntries(h);
    return h;
  };
return customFetch<CreatorWithdrawal>(getRequestCreatorWithdrawalUrl(),
  {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getHeaders(options?.headers) },
    body: JSON.stringify(creatorWithdrawalRequest)
  }
);}





export const getRequestCreatorWithdrawalMutationKey = () => ['requestCreatorWithdrawal'] as const;

export const getRequestCreatorWithdrawalMutationOptions = <TError = ErrorType<ErrorResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof requestCreatorWithdrawal>>, TError,RequestCreatorWithdrawalMutationVariables, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof requestCreatorWithdrawal>>, TError,RequestCreatorWithdrawalMutationVariables, TContext> => {

const mutationKey = getRequestCreatorWithdrawalMutationKey();
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof requestCreatorWithdrawal>>, RequestCreatorWithdrawalMutationVariables> = (props) => {
          const {data} = props ?? {};

          return  requestCreatorWithdrawal(data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type RequestCreatorWithdrawalMutationResult = NonNullable<Awaited<ReturnType<typeof requestCreatorWithdrawal>>>
    export type RequestCreatorWithdrawalMutationBody = BodyType<CreatorWithdrawalRequest>
    export type RequestCreatorWithdrawalMutationError = ErrorType<ErrorResponse>
    export type RequestCreatorWithdrawalMutationVariables = {data: BodyType<CreatorWithdrawalRequest>}

    /**
 * @summary Request a USD creator withdrawal from gift-earned Gold
 */
export const useRequestCreatorWithdrawal = <TError = ErrorType<ErrorResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof requestCreatorWithdrawal>>, TError,RequestCreatorWithdrawalMutationVariables, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof requestCreatorWithdrawal>>,
        TError,
        RequestCreatorWithdrawalMutationVariables,
        TContext
      > => {
      return useMutation(getRequestCreatorWithdrawalMutationOptions(options));
    }

export const getRequestUploadUrlUrl = () => {




  return `/api/storage/uploads/request-url`
}

/**
 * @summary Request a protected media upload endpoint
 */
export const requestUploadUrl = async (uploadUrlRequest: UploadUrlRequest, options?: Parameters<typeof customFetch>[1]): Promise<UploadUrlResponse> => {

    const getHeaders = (h?: NonNullable<RequestInit['headers']>): Record<string, string | readonly string[]> => {
    if (!h) return {};
    if (h instanceof Headers) return Object.fromEntries(h.entries());
    if (Array.isArray(h)) return Object.fromEntries(h);
    return h;
  };
return customFetch<UploadUrlResponse>(getRequestUploadUrlUrl(),
  {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getHeaders(options?.headers) },
    body: JSON.stringify(uploadUrlRequest)
  }
);}





export const getRequestUploadUrlMutationKey = () => ['requestUploadUrl'] as const;

export const getRequestUploadUrlMutationOptions = <TError = ErrorType<ErrorResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof requestUploadUrl>>, TError,RequestUploadUrlMutationVariables, TContext>, request?: SecondParameter<typeof customFetch>}
): UseMutationOptions<Awaited<ReturnType<typeof requestUploadUrl>>, TError,RequestUploadUrlMutationVariables, TContext> => {

const mutationKey = getRequestUploadUrlMutationKey();
const {mutation: mutationOptions, request: requestOptions} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }, request: undefined};




      const mutationFn: MutationFunction<Awaited<ReturnType<typeof requestUploadUrl>>, RequestUploadUrlMutationVariables> = (props) => {
          const {data} = props ?? {};

          return  requestUploadUrl(data,requestOptions)
        }






  return  { mutationFn, ...mutationOptions }}

    export type RequestUploadUrlMutationResult = NonNullable<Awaited<ReturnType<typeof requestUploadUrl>>>
    export type RequestUploadUrlMutationBody = BodyType<UploadUrlRequest>
    export type RequestUploadUrlMutationError = ErrorType<ErrorResponse>
    export type RequestUploadUrlMutationVariables = {data: BodyType<UploadUrlRequest>}

    /**
 * @summary Request a protected media upload endpoint
 */
export const useRequestUploadUrl = <TError = ErrorType<ErrorResponse>,
    TContext = unknown>(options?: { mutation?:UseMutationOptions<Awaited<ReturnType<typeof requestUploadUrl>>, TError,RequestUploadUrlMutationVariables, TContext>, request?: SecondParameter<typeof customFetch>}
 ): UseMutationResult<
        Awaited<ReturnType<typeof requestUploadUrl>>,
        TError,
        RequestUploadUrlMutationVariables,
        TContext
      > => {
      return useMutation(getRequestUploadUrlMutationOptions(options));
    }

export const getGetStorageObjectUrl = (objectPath: string,) => {




  return `/api/storage/objects/${objectPath}`
}

/**
 * @summary Serve a protected message attachment
 */
export const getStorageObject = async (objectPath: string, options?: Parameters<typeof customFetch>[1]): Promise<Blob> => {

  return customFetch<Blob>(getGetStorageObjectUrl(objectPath),
  {
    ...options,
    method: 'GET'


  }
);}





export const getGetStorageObjectQueryKey = (objectPath: string,) => {
    return [
    `/api/storage/objects/${objectPath}`
    ] as const;
    }


export const getGetStorageObjectQueryOptions = <TData = Awaited<ReturnType<typeof getStorageObject>>, TError = ErrorType<ErrorResponse>>(objectPath: string, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getStorageObject>>, TError, TData>, request?: SecondParameter<typeof customFetch>}
) => {

const {query: queryOptions, request: requestOptions} = options ?? {};

  const queryKey =  queryOptions?.queryKey ?? getGetStorageObjectQueryKey(objectPath);



    const queryFn: QueryFunction<Awaited<ReturnType<typeof getStorageObject>>> = ({ signal }) => getStorageObject(objectPath, { signal, ...requestOptions });





   return  { queryKey, queryFn, enabled: objectPath !== null && objectPath !== undefined, ...queryOptions} as UseQueryOptions<Awaited<ReturnType<typeof getStorageObject>>, TError, TData> & { queryKey: QueryKey }
}

export type GetStorageObjectQueryResult = NonNullable<Awaited<ReturnType<typeof getStorageObject>>>
export type GetStorageObjectQueryError = ErrorType<ErrorResponse>


/**
 * @summary Serve a protected message attachment
 */

export function useGetStorageObject<TData = Awaited<ReturnType<typeof getStorageObject>>, TError = ErrorType<ErrorResponse>>(
 objectPath: string, options?: { query?:UseQueryOptions<Awaited<ReturnType<typeof getStorageObject>>, TError, TData>, request?: SecondParameter<typeof customFetch>}

 ):  UseQueryResult<TData, TError> & { queryKey: QueryKey } {

  const queryOptions = getGetStorageObjectQueryOptions(objectPath,options)

  const query = useQuery(queryOptions) as  UseQueryResult<TData, TError> & { queryKey: QueryKey };

  return withQueryKey(query, queryOptions.queryKey);
}







