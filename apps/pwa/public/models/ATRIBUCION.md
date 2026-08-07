# Atribución del modelo 3D

`clk-w209.glb` no es obra de este proyecto. Su licencia obliga a acreditar
al autor, así que este fichero acompaña siempre al modelo.

**Obra:** [2003 Mercedes-Benz CLK 55 AMG](https://sketchfab.com/3d-models/2003-mercedes-benz-clk-55-amg-96c1c8f27333453db1cde651bc089708)
**Autor:** [Ddiaz Design](https://sketchfab.com/Ddiaz-Design)
**Licencia:** [CC Attribution-NonCommercial-ShareAlike](https://creativecommons.org/licenses/by-nc-sa/4.0/)
**Origen:** Sketchfab · fichero GLB, texturas a 2k

## Qué implica esta licencia

**Atribución.** Hay que acreditar al autor allí donde se use el modelo. En
VehicleOS aparece en la pantalla de Ajustes, junto al selector de vista del
vehículo.

**No comercial.** El modelo **no puede usarse en un producto que se venda
ni en material promocional de algo comercial**. Mientras VehicleOS sea un
proyecto personal no hay conflicto, pero si algún día se monetiza —o si la
landing pasa a promocionar una versión de pago— este modelo habría que
sustituirlo por uno con licencia comercial.

**Compartir igual.** Cualquier versión modificada del modelo hereda esta
misma licencia. Por eso el fichero se usa **tal cual, sin editar**: las
piezas que no interesan (habitáculo, volante) se ocultan en tiempo de
ejecución desde three.js, no recortando el `.glb`. Así no se genera una
obra derivada y se evita la duda.

## Alternativa si cambia la situación

La vista cenital en SVG (`packages/ui/src/VehicleModel.tsx`) es arte
original de este proyecto, sin dependencias de terceros, y sigue siendo la
vista por defecto. Si hubiera que retirar el modelo 3D, el cockpit
funcionaría igual: solo se perdería la vista alternativa.
