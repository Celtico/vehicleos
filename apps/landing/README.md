# @vehicleos/landing

Página de presentación de VehicleOS. Sitio estático: `next build` genera HTML
plano en `out/`, que se sirve desde cualquier hosting o CDN sin Node.

```bash
pnpm --filter @vehicleos/landing dev     # desarrollo en localhost:3002
pnpm --filter @vehicleos/landing build   # exporta a out/
```

## Decisiones

- **Capturas reales, no maquetas.** Las imágenes de `public/img` son del
  producto funcionando contra su backend. Si cambia la interfaz, hay que
  rehacerlas: una landing con capturas obsoletas engaña al comprador.
- **Dos temas, dos materiales.** En oscuro es la cabina de noche, con el
  turquesa de la instrumentación real; en claro es un manual de taller sobre
  papel cálido. El tema claro no es el oscuro invertido.
- **Portada viva.** El cuadro de la portada reproduce el barrido de agujas del
  autodiagnóstico al dar contacto y después enciende la avería en la rueda
  delantera izquierda. Se anima por refs, sin re-render por fotograma, y
  respeta `prefers-reduced-motion`.
- **Tipografías propias.** Se sirven desde `public/fonts` con `next/font/local`
  para no depender de un CDN externo. Las licencias OFL acompañan a cada
  fichero.
- **Sección de límites.** La página dice explícitamente lo que el producto NO
  puede hacer (presión de neumáticos sin TPMS, códigos de ABS con adaptador
  genérico). El público objetivo es técnico: prometer de más se paga en la
  primera avería.

## Despliegue

`out/` es autocontenido. Sirve esa carpeta con cualquier servidor estático:

```bash
npx serve apps/landing/out
```
