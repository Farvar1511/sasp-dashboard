import { trpc } from '../utils/trpc';

export default function Example() {
  const { data, isLoading } = trpc.hello.useQuery();

  if (isLoading) return <div>Loading...</div>;
  return <div>{data}</div>;
}
