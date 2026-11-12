/**
 * Who sees French Track Manager (#615): until the owner opens it to everybody, the admins only.
 * The database holds the same rule (private.require_manager_player).
 */
export function seesManager(player: { isAdmin: boolean }): boolean {
  return player.isAdmin;
}
