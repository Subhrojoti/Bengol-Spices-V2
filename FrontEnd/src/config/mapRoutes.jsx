export const mapRoutes = (routes) =>
  routes.map((route) => {
    const Component = route.component;
    return {
      path: route.path,
      element: <Component />,
    };
  });
