import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { storeApi, type CreateStoreInput } from "@/api/store.api";

export function useMyStores() {
  return useQuery({
    queryKey: ["stores", "mine"],
    queryFn: storeApi.getMyStores,
  });
}

export function useCreateStore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStoreInput) => storeApi.createStore(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stores"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["targets"] });
    },
  });
}
