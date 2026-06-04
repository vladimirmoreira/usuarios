import { useParams } from 'react-router-dom';
import AccesosEditor from './AccesosEditor';
import { AccesosAPI } from '../../api/endpoints';

export default function AccesosPage() {
  const { iduser = '' } = useParams();
  return (
    <AccesosEditor
      id={iduser}
      titulo="Menú de Accesos"
      subtitulo={`Usuario ${iduser}`}
      backTo="/usuarios"
      api={AccesosAPI}
      queryKey={['accesos', iduser]}
      scope="usuario"
    />
  );
}


