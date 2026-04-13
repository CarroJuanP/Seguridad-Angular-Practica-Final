// Ejemplo de configuracion para compartir la estructura sin exponer valores reales.
export const environment = {
  production: false,
  // El frontend debe conocer unicamente la URL del API Gateway.
  gatewayApiUrl: 'http://127.0.0.1:3000',
};
