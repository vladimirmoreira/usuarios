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
        onGuardadoExitoso={() => setShowPropagar(true)}
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
