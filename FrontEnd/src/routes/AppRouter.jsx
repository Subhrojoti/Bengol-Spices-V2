import { useRoutes } from 'react-router-dom';
import { Suspense } from 'react';
import { routes } from './routeConfig';

export default function AppRouter() {
  const element = useRoutes(routes);

  return (
    <Suspense fallback={<div>Loading...</div>}>
      {element}
    </Suspense>
  );
}