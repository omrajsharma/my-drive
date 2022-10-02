import { deleteObject, listAll, ref as storageRef, StorageReference, uploadBytes, uploadBytesResumable } from 'firebase/storage';
import { ChangeEvent, lazy, useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useSigninCheck, useStorage } from 'reactfire';
import { Navbar } from '../components/Navbar';
import { NoFiles } from '../components/common/NoFiles';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { ReferenceContainer } from '../components/ReferenceContainer';
import { UploadWidget } from '../components/UploadWidget';
import { Breadcumb } from '../components/Breadcumb';
import { Loadable, Barloader } from '../components/common/Loading';
import ForbiddenError from './errors/ForbiddenError';

const WorkspaceView = Loadable(lazy(() => import('./WorkspaceView')), Barloader);

export const Workspace = () => {

  const [items, setItems] = useState<StorageReference[]>([]);
  const [prefixes, setPrefixes] = useState<StorageReference[]>([]);

  const { status, data: signInCheckResult } = useSigninCheck({
    suspense: true
  });

  const storage = useStorage();


  const path = useParams()['*'] || signInCheckResult.user?.uid || '';

  const root = path?.split('/')[0];

  let listRef: StorageReference;
  listRef = storageRef(storage, path);


  /* handle search */
  const [search, setSearch] = useState('');
  const handleSearch = (val: string) => {
    setSearch(val);
  }

  const fetchItems = async () => {
    let { items: i, prefixes: p } = await listAll(listRef);
    /* remove emtpy items and .exists from list of items */
    i = i.filter(item => item.name !== '.exists');
    return { i, p };
  }

  useEffect(() => {
    console.log('updated')
    fetchItems().then(({ i, p }) => {
      if (search.length > 0) {
        const regex = new RegExp(search, 'i');
        const filteredItems = i?.filter(item => regex.test(item.name));
        const filteredPrefixes = p?.filter(prefix => regex.test(prefix.name));
        setItems(filteredItems);
        setPrefixes(filteredPrefixes);
      } else {
        setItems(i);
        setPrefixes(p);
      }
    })
  }, [path, search]);

  /* handle delete */
  const deleteFolder = (target: StorageReference) => {
    /* list all files and prefixes inside the folder to recursively delete */
    listAll(target).then((res) => {
      res.items.forEach((itemRef) => {
        deleteObject(itemRef);
        setItems(items?.filter(item => item.fullPath !== itemRef.fullPath));
      });
      res.prefixes.forEach((folderRef) => {
        deleteFolder(folderRef);
        setPrefixes(prefixes?.filter(prefix => prefix.fullPath !== folderRef.fullPath));
      });
      deleteObject(target);
    }).catch((error) => {
      toast.error(error.message);
    });
  }

  const deleteFile = (target: StorageReference) => {
    deleteObject(target).catch((error) => {
      toast.error(error.message);
    });
    setItems(items?.filter(item => item.fullPath !== target.fullPath));
  }

  const handleDelete = (target: StorageReference, type: string) => {
    /* ask confirmation to the user */
    const confirmation = window.confirm(`Are you sure you want to delete ${target.name}?`)
    if (confirmation && target) {
      if (type === 'prefix') {
        deleteFolder(target);
      } else {
        deleteFile(target);
      }
      toast.success(`Successfully deleted ${target.name}`)
    }
  }

  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  /* handle upload */
  const handleUpload = (event: ChangeEvent) => {
    const file = (event.target as HTMLInputElement).files?.item(0);
    if (file) {
        const ref = storageRef(storage, path + '/' + file.name)
        uploadBytesResumable(ref, file).then((snapshot) => {
            console.log('Uploaded a blob or file!');
            setItems([...items, ref]);
        }).catch((error) => {
            console.log(error)
        });
        
    }
    setShowContextMenu(false);
  }

  /* handlle new folder */
  const handleNewFolder  = async (name: string) => {
    const ref = storageRef(storage, path + '/' + name + '/' + '.exists')
    const file = new Blob(['.exists'])
    uploadBytes(ref, file).then((snapshot) => {
       const folderRef = storageRef(storage, path + '/' + name)
       setPrefixes([...prefixes, folderRef]);
    }).catch((error) => {
      console.log(error)
    });
    setShowNewFolder(false);
    setShowContextMenu(false);
  }

  if (signInCheckResult.signedIn) {
    return (
      <div>
        <ToastContainer />
        <Navbar onSearch={handleSearch} />

        <WorkspaceView path={path} items={items} prefixes={prefixes} onDelete={handleDelete} />

        {/* upload button positioned at bottom-right */}
        <UploadWidget onUpload={handleUpload} onNewFolder={handleNewFolder} showContextMenu={showContextMenu} showNewFolderMenu={showNewFolder}/>
        {/* <NewFolder show={showNewFolder} basePath={listRef} /> */}
      </div>
    )
  } else {
    return <Navigate to="/login" />;
  }
}

export default Workspace;
