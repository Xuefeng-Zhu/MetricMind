import { DatasetDetailPage } from "@/components/data-sources/dataset-detail-page";
import { getDataSourcesPageData } from "@/lib/data-sources/service";
import { createSemanticModelFromDatasetAction } from "../../../actions";

interface DatasetRouteProps {
  params: {
    sourceId: string;
    datasetId: string;
  };
}

export default async function DatasetRoute({ params }: DatasetRouteProps) {
  const initialData = await getDataSourcesPageData();

  return (
    <DatasetDetailPage
      initialData={initialData}
      sourceId={params.sourceId}
      datasetId={params.datasetId}
      createSemanticModelFromDatasetAction={createSemanticModelFromDatasetAction}
    />
  );
}
