import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Share2 } from 'lucide-react';
import AccesosEditor from './AccesosEditor';
import PropagateRolModal from './PropagateRolModal';
import { RolesAPI, CatalogosAPI } from '../../api/endpoints';

export default function RoleAccesosPage() {
  const { idperfil = '' } = useParams();
  const id = Number(idperfil);
  const [showPropagar, setShowPropagar] = useState(false);

  const perfilesQ = useQuery({
    queryKey: ['catalogos', 'perfiles'],
    queryFn: () => CatalogosAPI.perfiles(),
  });

  // Usuarios asignados al rol. Un rol recién creado no tiene usuarios: en ese caso
  // no tiene sentido ofrecer la propagación (no hay a quién propagar). Mismo
  // queryKey que usa PropagateRolModal para compartir caché.
  const usuariosQ = useQuery({
    queryKey: ['roles', id, 'usuarios'],
    queryFn: () => RolesAPI.listarUsuarios(id),
    enabled: id > 0,
    staleTime: 30_000,
  });

  const rol = perfilesQ.data?.find((p: any) => Number(p.idtipo_usuario) === id);

  return (
    <>
      <AccesosEditor
        id={id}
        titulo={rol ? `Rol: ${rol.descripcion}` : 'Accesos del Rol'}
        subtitulo={rol ? `Plantilla iduser: ${rol.iduser ?? '—'}` : undefined}
        backTo="/roles"
        api={RolesAPI as any}
        queryKey={['roles', 'accesos', id]}
        esAdmin={id === 1}
        onGuardadoExitoso={() => {
          // Solo ofrecer propagar si el rol ya tiene usuarios asignados.
          if ((usuariosQ.data?.length ?? 0) > 0) setShowPropagar(true);
        }}
      />
      {showPropagar && (
        <PropagateRolModal
          idperfil={id}
          rolNombre={rol?.descripcion ?? `Rol ${id}`}
          onClose={() => setShowPropagar(false)}
        />
      )}
    </>
  );
}
