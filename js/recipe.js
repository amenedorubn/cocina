// Carga una receta por id: primero recetas importadas (localStorage), luego /recetas/<id>.json
const Recipe = {
  async load(id) {
    const custom = Store.customRecipes();
    if (custom[id]) return custom[id];
    const res = await fetch(`recetas/${encodeURIComponent(id)}.json`);
    if (!res.ok) throw new Error('Receta no encontrada: ' + id);
    return res.json();
  },
};
