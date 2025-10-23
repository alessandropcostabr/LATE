// models/helpers/viewerScope.js
// Utilidades para aplicar restrições de visualização de recados conforme escopo do usuário.

function normalizeViewScope(scope) {
  return String(scope || 'all').trim().toLowerCase() === 'own' ? 'own' : 'all';
}

function buildViewerOwnershipFilter(
  viewer = {},
  placeholder = (i) => `$${i}`,
  startIndex = 1,
  { alias, supportsCreator } = {}
) {
  if (!viewer || normalizeViewScope(viewer.viewScope || viewer.view_scope) !== 'own') {
    return { clause: '', params: [], nextIndex: startIndex };
  }

  const idColumn = alias ? `${alias}.recipient_user_id` : 'recipient_user_id';
  const sectorColumn = alias ? `${alias}.recipient_sector_id` : 'recipient_sector_id';
  const nameColumn = alias ? `${alias}.recipient` : 'recipient';
  const visibilityColumn = alias ? `${alias}.visibility` : 'visibility';

  const clauses = [];
  const params = [];
  let index = startIndex;

  const viewerId = Number(viewer.id);
  if (Number.isInteger(viewerId) && viewerId > 0) {
    clauses.push(`${idColumn} = ${placeholder(index)}`);
    params.push(viewerId);
    index += 1;

    if (supportsCreator) {
      const creatorColumn = alias ? `${alias}.created_by` : 'created_by';
      clauses.push(`${creatorColumn} = ${placeholder(index)}`);
      params.push(viewerId);
      index += 1;
    }

    clauses.push(`(${sectorColumn} IS NOT NULL AND EXISTS (
      SELECT 1
        FROM user_sectors us
       WHERE us.user_id = ${placeholder(index)}
         AND us.sector_id = ${sectorColumn}
    ))`);
    params.push(viewerId);
    index += 1;
  }

  const viewerName = String(viewer.name || '').trim();
  if (viewerName) {
    clauses.push(`(${idColumn} IS NULL AND LOWER(TRIM(${nameColumn})) = LOWER(${placeholder(index)}))`);
    params.push(viewerName);
    index += 1;
  }

  let clause;
  if (clauses.length === 0) {
    clause = `${visibilityColumn} = 'public'`;
  } else {
    clause = `(${visibilityColumn} = 'public' OR ${clauses.join(' OR ')})`;
  }

  return {
    clause: `(${clause})`,
    params,
    nextIndex: index,
  };
}

module.exports = {
  buildViewerOwnershipFilter,
  normalizeViewScope,
};
