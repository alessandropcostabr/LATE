// controllers/helpers/viewer.js
// Reuso de lógica para resolver escopo do usuário logado nas views/controllers.

const UserSectorModel = require('../../models/userSector');

function getViewerFromRequest(req) {
  const sessionUser = req.session?.user;
  if (!sessionUser) return null;
  return {
    id: sessionUser.id,
    name: sessionUser.name,
    viewScope: sessionUser.viewScope || sessionUser.view_scope || 'all',
  };
}

async function resolveViewerWithSectors(req) {
  if (req._viewerCache) return req._viewerCache;

  const base = getViewerFromRequest(req);
  if (!base || !Number.isInteger(Number(base.id))) {
    req._viewerCache = base;
    return base;
  }

  try {
    const sectors = await UserSectorModel.listUserSectors(base.id);
    base.sectorIds = sectors
      .map((sector) => Number(sector.id))
      .filter((id) => Number.isInteger(id) && id > 0);
  } catch (err) {
    console.warn('[viewer] falha ao carregar setores do usuário', {
      userId: base.id,
      err: err?.message || err,
    });
    base.sectorIds = [];
  }

  req._viewerCache = base;
  return base;
}

module.exports = {
  getViewerFromRequest,
  resolveViewerWithSectors,
};
